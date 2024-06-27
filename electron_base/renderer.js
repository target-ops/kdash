const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

let k8sApi;
let k8sEventApi;


const contextSelect = document.getElementById('context-select');
const namespaceSelect = document.getElementById('namespace-select');
const podFilter = document.getElementById('pod-filter');

const ITEMS_PER_PAGE = 10;
let currentObjectsPage = 1;
let currentEventsPage = 1;
let allObjects = [];
let allEvents = [];

const toolbar = document.getElementById('k8s-toolbar');
let selectedObject = 'all';

const k8sObjects = [
    { name: 'All', apiGroup: '', kind: '' },
    { name: 'Pods', apiGroup: '', kind: 'Pod' },
    { name: 'Services', apiGroup: '', kind: 'Service' },
    { name: 'Deployments', apiGroup: 'apps', kind: 'Deployment' },
    { name: 'ConfigMaps', apiGroup: '', kind: 'ConfigMap' },
    { name: 'Secrets', apiGroup: '', kind: 'Secret' },
    { name: 'Ingresses', apiGroup: 'networking.k8s.io', kind: 'Ingress' },
    { name: 'PersistentVolumes', apiGroup: '', kind: 'PersistentVolume' },
    { name: 'PersistentVolumeClaims', apiGroup: '', kind: 'PersistentVolumeClaim' },
    { name: 'Namespaces', apiGroup: '', kind: 'Namespace' },
    { name: 'CustomResourceDefinitions', apiGroup: 'apiextensions.k8s.io', kind: 'CustomResourceDefinition' },
];
const k8sObjectsMap = new Map(k8sObjects.filter(obj => obj.kind).map(obj => [obj.kind, obj]));

function createToolbar() {
    const toolbar = document.getElementById('k8s-toolbar');
    if (!toolbar) {
        console.error('Toolbar element not found. Make sure the HTML is correct.');
        return;
    }

    k8sObjects.forEach(obj => {
        const button = document.createElement('button');
        button.textContent = obj.name;
        button.addEventListener('click', () => {
            selectedObject = obj.kind || 'all';
            console.log('Selected object:', selectedObject);
            updateToolbarButtons();
            fetchK8sObjects(selectedObject);
        });
        toolbar.appendChild(button);
    });
    updateToolbarButtons();
}
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const debouncedFetchK8sObjects = debounce(fetchK8sObjects, 300);

podFilter.addEventListener('input', () => {
    debouncedFetchK8sObjects(selectedObject);
});
// function updateToolbarButtons() {
//     const toolbar = document.getElementById('k8s-toolbar');
//     if (!toolbar) return;

//     Array.from(toolbar.children).forEach(button => {
//         const objKind = k8sObjects.find(obj => obj.name === button.textContent)?.kind || 'all';
//         button.classList.toggle('active', selectedObject === objKind);
//     });
// }
function updateToolbarButtons() {
    const toolbar = document.getElementById('k8s-toolbar');
    if (!toolbar) return;

    Array.from(toolbar.children).forEach(button => {
        const objKind = k8sObjects.find(obj => obj.name === button.textContent)?.kind || 'all';
        button.classList.toggle('active', selectedObject === objKind);
    });
    console.log('Updated toolbar buttons. Selected object:', selectedObject);
}
async function populateContexts() {
    const contexts = kc.getContexts();
    contextSelect.innerHTML = '';
    contexts.forEach(context => {
        const option = document.createElement('option');
        option.value = context.name;
        option.textContent = context.name;
        contextSelect.appendChild(option);
    });

    const currentContext = kc.getCurrentContext();
    contextSelect.value = currentContext;
}

async function populateNamespaces() {
    try {
        const namespaces = await k8sApi.listNamespace();
        namespaceSelect.innerHTML = '<option value="all">All Namespaces</option>';
        namespaces.body.items.forEach(ns => {
            const option = document.createElement('option');
            option.value = ns.metadata.name;
            option.textContent = ns.metadata.name;
            namespaceSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching namespaces:', error);
    }
}

function updateK8sApi() {
    const selectedContext = contextSelect.value;
    kc.setCurrentContext(selectedContext);
    k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    k8sEventApi = kc.makeApiClient(k8s.EventsV1Api);
}

let loadingBar;
let loadingBarProgress;

function initializeLoadingBar() {
    loadingBar = document.getElementById('loading-bar');
    loadingBarProgress = document.querySelector('.loading-bar-progress');
    
    if (!loadingBar || !loadingBarProgress) {
        console.error('Loading bar elements not found. Make sure the HTML is correct.');
    }
}

function showLoadingBar() {
    if (loadingBar) {
        loadingBar.style.display = 'block';
    }
    if (loadingBarProgress) {
        loadingBarProgress.style.width = '0%';
    }
}

function updateLoadingBar(progress) {
    if (loadingBarProgress) {
        loadingBarProgress.style.width = `${progress}%`;
    }
}

function hideLoadingBar() {
    if (loadingBar) {
        loadingBar.style.display = 'none';
    }
}
async function fetchK8sObjects(objectType) {
    try {
        showLoadingBar();
        const selectedNamespace = namespaceSelect.value;

        console.log('Fetching objects. Type:', objectType, 'Namespace:', selectedNamespace);

        if (!objectType || objectType === 'all') {
            allObjects = [];
            for (const obj of k8sObjects) {
                if (obj.kind) {
                    const objects = await fetchSingleObjectType(obj.kind, selectedNamespace);
                    allObjects = allObjects.concat(objects);
                }
            }
        } else {
            allObjects = await fetchSingleObjectType(objectType, selectedNamespace);
        }

        updateLoadingBar(100);
        setTimeout(hideLoadingBar, 300);

        updateObjectsTable();
    } catch (error) {
        console.error('Error fetching Kubernetes objects:', error);
        hideLoadingBar();
        updateObjectsTable();
    }
}

async function fetchSingleObjectType(objectType, selectedNamespace) {
    if (objectType === 'all') {
        return [];
    }

    const obj = k8sObjectsMap.get(objectType);
    if (!obj) throw new Error(`Unsupported object type: ${objectType}`);
    updateLoadingBar(20);

    let api;
    switch (obj.apiGroup) {
        case 'apps':
            api = kc.makeApiClient(k8s.AppsV1Api);
            break;
        case 'networking.k8s.io':
            api = kc.makeApiClient(k8s.NetworkingV1Api);
            break;
        case 'apiextensions.k8s.io':
            api = kc.makeApiClient(k8s.ApiextensionsV1Api);
            break;
        default:
            api = k8sApi;
    }

    updateLoadingBar(40);

    let response;
    try {
        if (obj.kind === 'PersistentVolume' || obj.kind === 'CustomResourceDefinition') {
            // These are cluster-scoped resources, not namespaced
            response = await api[`list${obj.kind}`]();
        } else if (selectedNamespace === 'all') {
            response = await api[`list${obj.kind}ForAllNamespaces`]();
        } else {
            response = await api[`listNamespaced${obj.kind}`](selectedNamespace);
        }
    } catch (error) {
        console.error(`Error fetching ${obj.kind}:`, error);
        throw error;
    }

    updateLoadingBar(80);

    return response.body.items.map(item => ({
        namespace: item.metadata.namespace || 'N/A',
        kind: obj.kind,
        name: item.metadata.name,
        age: new Date(item.metadata.creationTimestamp).toLocaleString(),
        tooltip: generateTooltip(item, obj.kind),
        status: item.status && item.status.phase ? item.status.phase : 'Unknown' // Add this line
    }));
}
// async function fetchK8sObjects(objectType) {
//     try {
//         showLoadingBar();
//         const selectedNamespace = namespaceSelect.value;

//         console.log('Fetching objects. Type:', objectType, 'Namespace:', selectedNamespace);

//         if (!objectType || objectType === 'all') {
//             // Handle 'all' case or undefined objectType
//             allObjects = [];
//             for (const obj of k8sObjects) {
//                 if (obj.kind) {
//                     const objects = await fetchSingleObjectType(obj.kind, selectedNamespace);
//                     allObjects = allObjects.concat(objects);
//                 }
//             }
//         } else {
//             allObjects = await fetchSingleObjectType(objectType, selectedNamespace);
//         }

//         updateLoadingBar(100);
//         setTimeout(hideLoadingBar, 300);

//         updateObjectsTable();
//     } catch (error) {
//         console.error('Error fetching Kubernetes objects:', error);
//         hideLoadingBar();
//         updateObjectsTable();
//     }
// }
// async function fetchSingleObjectType(objectType, selectedNamespace) {
//     if (objectType === 'all') {
//         // Return an empty array for 'all' case, as it's handled in fetchK8sObjects
//         return [];
//     }

//     const obj = k8sObjectsMap.get(objectType);
//     if (!obj) throw new Error(`Unsupported object type: ${objectType}`);
//     updateLoadingBar(20);

//     const api = obj.apiGroup ? 
//         kc.makeApiClient(k8s[`${obj.apiGroup.split('.')[0].charAt(0).toUpperCase() + obj.apiGroup.split('.')[0].slice(1)}Api`]) :
//         k8sApi;

//     updateLoadingBar(40);

//     let response;
//     if (selectedNamespace === 'all') {
//         response = await api[`list${obj.kind}ForAllNamespaces`]();
//     } else {
//         response = await api[`listNamespaced${obj.kind}`](selectedNamespace);
//     }

//     updateLoadingBar(80);

//     return response.body.items.map(item => ({
//         namespace: item.metadata.namespace,
//         kind: obj.kind,
//         name: item.metadata.name,
//         age: new Date(item.metadata.creationTimestamp).toLocaleString(),
//         tooltip: generateTooltip(item, obj.kind)
//     }));
// }

async function getContinueToken(objectType, targetPage) {
    let currentPage = 1;
    let continueToken = '';

    while (currentPage < targetPage) {
        const response = await fetchK8sObjects(objectType, currentPage);
        continueToken = response.body.metadata.continue;
        if (!continueToken) break;
        currentPage++;
    }

    return continueToken;
}
function generateTooltip(item, kind) {
    let tooltip = `
        Kind: ${kind}<br>
        Name: ${item.metadata.name}<br>
        Namespace: ${item.metadata.namespace || 'N/A'}<br>
        Creation Time: ${new Date(item.metadata.creationTimestamp).toLocaleString()}
    `;
    if (kind === 'Pod' && item.status && item.status.phase) {
        tooltip += `<br>Status: ${item.status.phase}`;
    }
    return tooltip;
}

async function fetchK8sEvents() {
    try {
        const selectedNamespace = namespaceSelect.value;
        let events;

        if (selectedNamespace === 'all') {
            events = await k8sEventApi.listEventForAllNamespaces();
        } else {
            events = await k8sEventApi.listNamespacedEvent(selectedNamespace);
        }

        allEvents = events.body.items;
        updateEventsTable();
    } catch (error) {
        console.error('Error fetching Kubernetes events:', error);
        updateEventsTable();
    }
}

function createTooltip(content) {
    return `
        <span class="tooltip">ℹ
            <span class="tooltiptext">${content}</span>
        </span>
    `;
}
const cache = new Map();
const CACHE_EXPIRY = 30000; // 30 seconds

function getCachedData(key) {
    if (cache.has(key)) {
        const { data, timestamp } = cache.get(key);
        if (Date.now() - timestamp < CACHE_EXPIRY) {
            return data;
        }
    }
    return null;
}

function setCachedData(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}
async function showObjectYaml(obj) {
    try {
        const yamlContent = await getObjectYaml(obj.kind, obj.name, obj.namespace);
        showYamlModal(yamlContent);
    } catch (error) {
        console.error('Error fetching YAML:', error);
        showYamlModal(`Error fetching YAML for ${obj.kind}/${obj.name}: ${error.message}`);
    }
}
function getStatusDot(status) {
    let statusClass;
    switch (status.toLowerCase()) {
        case 'running':
            statusClass = 'status-running';
            break;
        case 'pending':
            statusClass = 'status-pending';
            break;
        case 'failed':
            statusClass = 'status-failed';
            break;
        case 'unknown':
            statusClass = 'status-unknown';
            break;
        case 'succeeded':
            statusClass = 'status-succeeded';
            break;
        default:
            statusClass = 'status-other';
    }
    return `<span class="status-dot ${statusClass}" title="${status}"></span>`;
}
function updateObjectsTable() {
    const tableBody = document.querySelector('#k8s-objects tbody');
    const fragment = document.createDocumentFragment();

    allObjects.forEach(obj => {
        const row = document.createElement('tr');
        const statusDot = obj.kind === 'Pod' ? getStatusDot(obj.status) : '';
        row.innerHTML = `
            <td>${obj.namespace === 'N/A' ? '-' : obj.namespace}</td>
            <td>${obj.kind}</td>
            <td>${statusDot}${obj.name} ${createTooltip(obj.tooltip)}</td>
            <td>${obj.age}</td>
        `;
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => showObjectYaml(obj));
        fragment.appendChild(row);
    });

    tableBody.innerHTML = '';
    tableBody.appendChild(fragment);

    updateObjectsPagination();
}
function updateEventsTable() {
    const tableBody = document.querySelector('#k8s-events tbody');
    tableBody.innerHTML = '';

    const startIndex = (currentEventsPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedEvents = allEvents.slice(startIndex, endIndex);

    paginatedEvents.forEach(event => {
        const row = tableBody.insertRow();
        row.insertCell(0).textContent = event.metadata.namespace;
        row.insertCell(1).textContent = event.type;
        row.insertCell(2).textContent = event.reason;
        row.insertCell(3).textContent = `${event.regarding.kind}/${event.regarding.name}`;
        row.insertCell(4).textContent = event.note;
        row.insertCell(5).textContent = new Date(event.eventTime).toLocaleString();
    });

    updateEventsPagination();
}

function updateObjectsPagination() {
    const totalPages = Math.ceil(allObjects.length / ITEMS_PER_PAGE);
    document.getElementById('objects-page-info').textContent = `Page ${currentObjectsPage} of ${totalPages}`;
    document.getElementById('objects-prev-page').disabled = currentObjectsPage === 1;
    document.getElementById('objects-next-page').disabled = currentObjectsPage === totalPages;
}

function updateEventsPagination() {
    const totalPages = Math.ceil(allEvents.length / ITEMS_PER_PAGE);
    document.getElementById('events-page-info').textContent = `Page ${currentEventsPage} of ${totalPages}`;
    document.getElementById('events-prev-page').disabled = currentEventsPage === 1;
    document.getElementById('events-next-page').disabled = currentEventsPage === totalPages;
}

// Event Listeners
contextSelect.addEventListener('change', async () => {
    updateK8sApi();
    await populateNamespaces();
    currentObjectsPage = 1;
    currentEventsPage = 1;
    await fetchK8sObjects();
    await fetchK8sEvents();
});

namespaceSelect.addEventListener('change', async () => {
    currentObjectsPage = 1;
    currentEventsPage = 1;
    await fetchK8sObjects();
    await fetchK8sEvents();
});

podFilter.addEventListener('input', async () => {
    currentObjectsPage = 1;
    await fetchK8sObjects();
});

document.getElementById('objects-prev-page').addEventListener('click', () => {
    if (currentObjectsPage > 1) {
        currentObjectsPage--;
        updateObjectsTable();
    }
});

document.getElementById('objects-next-page').addEventListener('click', () => {
    if (currentObjectsPage < Math.ceil(allObjects.length / ITEMS_PER_PAGE)) {
        currentObjectsPage++;
        updateObjectsTable();
    }
});

document.getElementById('events-prev-page').addEventListener('click', () => {
    if (currentEventsPage > 1) {
        currentEventsPage--;
        updateEventsTable();
    }
});

document.getElementById('events-next-page').addEventListener('click', () => {
    if (currentEventsPage < Math.ceil(allEvents.length / ITEMS_PER_PAGE)) {
        currentEventsPage++;
        updateEventsTable();
    }
});

const yaml = require('js-yaml');

function showYamlModal(content) {
    const modal = document.getElementById('yaml-modal');
    const yamlContent = document.getElementById('yaml-content');
    yamlContent.textContent = content;
    modal.style.display = "block";
}

function hideYamlModal() {
    const modal = document.getElementById('yaml-modal');
    modal.style.display = "none";
}

async function getObjectYaml(kind, name, namespace) {
    console.log('Getting YAML for:', kind, name, namespace);
    try {
        let result;
        let api;

        const obj = k8sObjectsMap.get(kind);
        if (!obj) throw new Error(`Unsupported kind: ${kind}`);

        switch (obj.apiGroup) {
            case 'apps':
                api = kc.makeApiClient(k8s.AppsV1Api);
                break;
            case 'networking.k8s.io':
                api = kc.makeApiClient(k8s.NetworkingV1Api);
                break;
            case 'apiextensions.k8s.io':
                api = kc.makeApiClient(k8s.ApiextensionsV1Api);
                break;
            default:
                api = k8sApi;
        }

        switch (kind) {
            case 'Pod':
                result = await api.readNamespacedPod(name, namespace);
                break;
            case 'Service':
                result = await api.readNamespacedService(name, namespace);
                break;
            case 'Deployment':
                result = await api.readNamespacedDeployment(name, namespace);
                break;
            case 'Ingress':
                result = await api.readNamespacedIngress(name, namespace);
                break;
            case 'PersistentVolume':
                result = await api.readPersistentVolume(name);
                break;
            case 'PersistentVolumeClaim':
                result = await api.readNamespacedPersistentVolumeClaim(name, namespace);
                break;
            case 'CustomResourceDefinition':
                result = await api.readCustomResourceDefinition(name);
                break;
            // ... other cases ...
            default:
                throw new Error(`Unsupported kind: ${kind}`);
        }
        console.log('API result:', result);
        return yaml.dump(result.body);
    } catch (error) {
        console.error('Error fetching object YAML:', error);
        throw error;
    }
}
// async function getObjectYaml(kind, name, namespace) {
//     try {
//         let result;
//         if (kind === 'Pod') {
//             result = await k8sApi.readNamespacedPod(name, namespace);
//         } else if (kind === 'Service') {
//             result = await k8sApi.readNamespacedService(name, namespace);
//         } else {
//             throw new Error(`Unsupported kind: ${kind}`);
//         }
//         return yaml.dump(result.body);
//     } catch (error) {
//         console.error('Error fetching object YAML:', error);
//         return `Error fetching YAML for ${kind}/${name}: ${error.message}`;
//     }
// }
function setupModalListeners() {
    const modal = document.getElementById('yaml-modal');
    const closeButton = document.getElementById('close-yaml-modal');

    // Close the modal when clicking the close button
    closeButton.onclick = function() {
        hideYamlModal();
    }

    // Close the modal when clicking outside of it
    window.onclick = function(event) {
        if (event.target == modal) {
            hideYamlModal();
        }
    }
}

function hideYamlModal() {
    const modal = document.getElementById('yaml-modal');
    modal.style.display = "none";
}
function createToolbar() {
    const toolbar = document.getElementById('k8s-toolbar');
    if (!toolbar) {
        console.error('Toolbar element not found. Make sure the HTML is correct.');
        return;
    }

    k8sObjects.forEach(obj => {
        const button = document.createElement('button');
        button.textContent = obj.name;
        button.addEventListener('click', () => {
            selectedObject = obj.kind || 'all';
            console.log('Selected object:', selectedObject);
            updateToolbarButtons();
            fetchK8sObjects(selectedObject);
        });
        toolbar.appendChild(button);
    });
    updateToolbarButtons();
}
// function createToolbar() {
//     const toolbar = document.getElementById('k8s-toolbar');
//     if (!toolbar) {
//         console.error('Toolbar element not found. Make sure the HTML is correct.');
//         return;
//     }

//     k8sObjects.forEach(obj => {
//         const button = document.createElement('button');
//         button.textContent = obj.name;
//         button.addEventListener('click', () => {
//             selectedObject = obj.name === 'All' ? 'all' : obj.kind;
//             console.log('Selected object:', selectedObject); // Add this line
//             updateToolbarButtons();
//             if (selectedObject !== 'all') {
//                 fetchK8sObjects(selectedObject);
//             } else {
//                 allObjects = [];
//                 updateObjectsTable();
//             }
//         });
//         toolbar.appendChild(button);
//     });
//     updateToolbarButtons();
// }

namespaceSelect.addEventListener('change', async () => {
    console.log('Namespace changed. Selected object:', selectedObject);
    currentObjectsPage = 1;
    currentEventsPage = 1;
    await fetchK8sObjects(selectedObject);
    await fetchK8sEvents();
});
// Initialize
async function init() {
    loadingBar = document.getElementById('loading-bar');
    loadingBarProgress = document.querySelector('.loading-bar-progress');
    await populateContexts();
    updateK8sApi();
    await populateNamespaces();
    createToolbar();
    initializeLoadingBar();  // Add this line
    setupModalListeners();
        await fetchK8sObjects();
    await fetchK8sEvents();
    setupModalListeners();  // Add this line
    closeButton.onclick = function() {
        console.log('Close button clicked');
        hideYamlModal();
    }
}
// async function init() {
//     await populateContexts();
//     updateK8sApi();
//     await populateNamespaces();
//     createToolbar();  // Add this line
//     await fetchK8sObjects();
//     await fetchK8sEvents();
//     setupModalListeners();  // Add this line
//     closeButton.onclick = function() {
//         console.log('Close button clicked');
//         hideYamlModal();
//     }
// //     document.querySelector('.close').addEventListener('click', hideYamlModal);
// // window.addEventListener('click', (event) => {
// //     if (event.target === document.getElementById('yaml-modal')) {
// //         hideYamlModal();
// //     }
// // });
// }

init();

// // Update every 5 seconds
// setInterval(async () => {
//     await fetchK8sObjects();
//     await fetchK8sEvents();
// }, 5000);