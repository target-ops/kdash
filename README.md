# 🚀 kdash

![alt text](https://github.com/rfyiamcool/golang_logo/blob/master/png/golang_98.png?raw=false)


Welcome to **kdash**,a Kubernetes dashboard application that provides a user-friendly interface for monitoring and managing Kubernetes clusters. It allows users to view and interact with various Kubernetes objects, events, and related information.

## 🌟 Features

* Context and namespace selection
* Dynamic object filtering
* Pagination for Kubernetes objects and events
* YAML viewing for Kubernetes objects
* Object relationship mapping
* Real-time updates (every 5 seconds)

## Screenshots: 
![alt text](image.png)

## 📦 Installation
### Option 1 From source
#### prerequisites
```
- Node.js (v14.0.0 or later)
- npm (v6.0.0 or later)
- Git
```
1. Clone the repository:
```
git clone https://github.com/target-ops/kdash.git
```

2. Navigate to the `kdash` directory:
```
run `npm install`
run `npm start` - For dev mode
run `npm run dist` - To build distribuition for prod ready - macos base dmg
```
This will create a `.dmg` file in the `dist` folder.
For other platforms, you can specify the platform:
```
npm run dist -- --mac
npm run dist -- --win
npm run dist -- --linux
```

### Option 2 Clear dmg install 

1. Download dmg from latest release https://github.com/target-ops/kdash/releases

## 💡 Contributing

We welcome contributions from the community! Feel free to fork the repository and submit pull requests. To contribute, follow these steps:

1. Fork the repository.
2. Create a new branch: 
```
    git checkout -b my-feature-branch
```

3. Make your changes and commit them:
```
    git commit -m 'Add some feature'
```

4. Push to the branch:
```
    git push origin my-feature-branch
```

5. Submit a pull request.

## 💡 Contributing
We welcome contributions from the community! Feel free to fork the repository and submit pull requests.
```
Fork the repository.
Create a new branch: git checkout -b my-feature-branch.
Make your changes and commit them: git commit -m 'Add some feature'.
Push to the branch: git push origin my-feature-branch.
Submit a pull request.
```
## Core required for ghpage
https://github.com/jrnewton/github-readme-to-html 
```
npx github-readme-to-html README.md
cp dist/index.html ./README.html && rm -rf ./dist/
```
