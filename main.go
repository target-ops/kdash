package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"
)

type K8sObject struct {
	Namespace string
	Kind      string
	Name      string
	Age       string
}
func openBrowser(url string) error {
	var err error

	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	default:
		err = fmt.Errorf("unsupported platform")
	}

	return err
}

func main() {
	var kubeconfig *string
	if home := homedir.HomeDir(); home != "" {
		kubeconfig = flag.String("kubeconfig", filepath.Join(home, ".kube", "config"), "(optional) absolute path to the kubeconfig file")
	} else {
		kubeconfig = flag.String("kubeconfig", "", "absolute path to the kubeconfig file")
	}
	namespace := flag.String("namespace", "", "namespace to list objects from (default is all namespaces)")
	outputFile := flag.String("output", "k8s_objects.html", "output HTML file name")
	flag.Parse()

	config, err := clientcmd.BuildConfigFromFlags("", *kubeconfig)
	if err != nil {
		panic(err.Error())
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		panic(err.Error())
	}

	var objects []K8sObject

	listObjects := func(namespace string) {
		// List Pods
		pods, _ := clientset.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{})
		for _, pod := range pods.Items {
			objects = append(objects, K8sObject{
				Namespace: pod.Namespace,
				Kind:      "Pod",
				Name:      pod.Name,
				Age:       time.Since(pod.CreationTimestamp.Time).Round(time.Second).String(),
			})
		}

		// List Services
		services, _ := clientset.CoreV1().Services(namespace).List(context.TODO(), metav1.ListOptions{})
		for _, svc := range services.Items {
			objects = append(objects, K8sObject{
				Namespace: svc.Namespace,
				Kind:      "Service",
				Name:      svc.Name,
				Age:       time.Since(svc.CreationTimestamp.Time).Round(time.Second).String(),
			})
		}

		// List Deployments
		deployments, _ := clientset.AppsV1().Deployments(namespace).List(context.TODO(), metav1.ListOptions{})
		for _, deploy := range deployments.Items {
			objects = append(objects, K8sObject{
				Namespace: deploy.Namespace,
				Kind:      "Deployment",
				Name:      deploy.Name,
				Age:       time.Since(deploy.CreationTimestamp.Time).Round(time.Second).String(),
			})
		}

		// Add more resource types as needed
	}

	if *namespace != "" {
		listObjects(*namespace)
	} else {
		namespaces, _ := clientset.CoreV1().Namespaces().List(context.TODO(), metav1.ListOptions{})
		for _, ns := range namespaces.Items {
			listObjects(ns.Name)
		}
	}

	generateHTML(objects, *outputFile)
	fmt.Printf("HTML output generated: %s\n", *outputFile)

	// Get the absolute path of the output file
	absPath, err := filepath.Abs(*outputFile)
	if err != nil {
		fmt.Printf("Error getting absolute path: %v\n", err)
		return
	}

	// Construct the file URL
	fileURL := fmt.Sprintf("file://%s", absPath)

	// Open the browser
	fmt.Println("Opening the generated HTML file in your default browser...")
	if err := openBrowser(fileURL); err != nil {
		fmt.Printf("Error opening browser: %v\n", err)
	}
}

func generateHTML(objects []K8sObject, outputFile string) {
	html := `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kubernetes Objects</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f0f0f0;
        }
        h1 {
            color: #333;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            background-color: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        th, td {
            text-align: left;
            padding: 12px;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #4CAF50;
            color: white;
        }
        tr:nth-child(even) {
            background-color: #f2f2f2;
        }
        tr:hover {
            background-color: #ddd;
        }
    </style>
</head>
<body>
    <h1>Kubernetes Objects</h1>
    <table>
        <tr>
            <th>Namespace</th>
            <th>Kind</th>
            <th>Name</th>
            <th>Age</th>
        </tr>
`

	for _, obj := range objects {
		html += fmt.Sprintf("<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>\n",
			obj.Namespace, obj.Kind, obj.Name, obj.Age)
	}

	html += `
    </table>
</body>
</html>
`

	err := os.WriteFile(outputFile, []byte(html), 0644)
	if err != nil {
		panic(err)
	}
}