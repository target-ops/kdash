const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

let k8sApi;
let k8sEventApi;

const contextSelect = document.getElementById('context-select');

function populateContexts() {
    const contexts = kc.getContexts();
    contexts.forEach(context => {
        const option = document.createElement('option');
        option.value = context.name;
        option.textContent = context.name;
        contextSelect.appendChild(option);
    });

    // Set the current context as selected
    const currentContext = kc.getCurrentContext();
    contextSelect.value = currentContext;
}

function updateK8sApi() {
    const selectedContext = contextSelect.value;
    kc.setCurrentContext(selectedContext);
    k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    k8sEventApi = kc.makeApiClient(k8s.EventsV1Api);
}

contextSelect.addEventListener('change', () => {
    updateK8sApi();
    fetchK8sObjects();
    fetchK8sEvents();
});

function createTooltip(content) {
    return `
        <div class="tooltip">
            &#9432;
            <span class="tooltiptext">${content}</span>
        </div>
    `;
}

function updateObjectsTable(objects) {
    const table = document.getElementById('k8s-objects');
    // Clear existing rows except the header
    while (table.rows.length > 1) {
        table.deleteRow(1);
    }

    objects.forEach(obj => {
        const row = table.insertRow();
        row.insertCell(0).textContent = obj.namespace;
        row.insertCell(1).textContent = obj.kind;
        
        const nameCell = row.insertCell(2);
        nameCell.innerHTML = `${obj.name} ${createTooltip(obj.tooltip)}`;
        
        row.insertCell(3).textContent = obj.age;
    });
}

function updateEventsTable(events) {
    const table = document.getElementById('k8s-events');
    // Clear existing rows except the header
    while (table.rows.length > 1) {
        table.deleteRow(1);
    }

    events.forEach(event => {
        const row = table.insertRow();
        row.insertCell(0).textContent = event.metadata.namespace;
        row.insertCell(1).textContent = event.type;
        row.insertCell(2).textContent = event.reason;
        row.insertCell(3).textContent = `${event.regarding.kind}/${event.regarding.name}`;
        row.insertCell(4).textContent = event.note;
        row.insertCell(5).textContent = new Date(event.eventTime).toLocaleString();
    });
}

async function fetchK8sObjects() {
    try {
        const pods = await k8sApi.listPodForAllNamespaces();
        const services = await k8sApi.listServiceForAllNamespaces();

        const objects = [
            ...pods.body.items.map(pod => ({
                namespace: pod.metadata.namespace,
                kind: 'Pod',
                name: pod.metadata.name,
                age: new Date(pod.metadata.creationTimestamp).toLocaleString(),
                tooltip: `
                    Status: ${pod.status.phase}<br>
                    IP: ${pod.status.podIP}<br>
                    Node: ${pod.spec.nodeName}<br>
                    Containers: ${pod.spec.containers.map(c => c.name).join(', ')}
                `
            })),
            ...services.body.items.map(svc => ({
                namespace: svc.metadata.namespace,
                kind: 'Service',
                name: svc.metadata.name,
                age: new Date(svc.metadata.creationTimestamp).toLocaleString(),
                tooltip: `
                    Type: ${svc.spec.type}<br>
                    Cluster IP: ${svc.spec.clusterIP}<br>
                    Ports: ${svc.spec.ports.map(p => `${p.port}/${p.protocol}`).join(', ')}<br>
                    Selector: ${Object.entries(svc.spec.selector || {}).map(([k, v]) => `${k}=${v}`).join(', ')}
                `
            }))
        ];

        updateObjectsTable(objects);
    } catch (error) {
        console.error('Error fetching Kubernetes objects:', error);
        updateObjectsTable([]);  // Clear the table on error
    }
}

async function fetchK8sEvents() {
    try {
        const events = await k8sEventApi.listEventForAllNamespaces();
        updateEventsTable(events.body.items);
    } catch (error) {
        console.error('Error fetching Kubernetes events:', error);
        updateEventsTable([]);  // Clear the table on error
    }
}

// Populate contexts and set up initial API client
populateContexts();
updateK8sApi();

// Fetch objects and events initially
fetchK8sObjects();
fetchK8sEvents();

// Update every 5 seconds
setInterval(() => {
    fetchK8sObjects();
    fetchK8sEvents();
}, 5000);