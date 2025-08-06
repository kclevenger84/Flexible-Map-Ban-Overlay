const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require("http");
const fs = require("fs");
const WebSocket = require("ws");

let mainWindow;
let server;
let wss;

// Handle different environments (dev vs packaged)
const isDev = process.env.NODE_ENV === 'development' || process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath);

const getResourcePath = (relativePath) => {
    if (isDev) {
        return path.join(__dirname, relativePath);
    } else {
        // In packaged app, resources are in the app.asar or extraResources
        return path.join(process.resourcesPath, relativePath);
    }
};

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 500,
        height: 750,
        webPreferences: {
            //nodeIntegration: true,
            //contextIsolation: false,
            preload: path.join(__dirname, 'preload.js'), // Use preload script for security
        },
    });
    mainWindow.loadFile('index.html');

    const controllerPath = isDev
        ? path.join(__dirname, 'controller.html')
        : path.join(__dirname, 'controller.html');

    mainWindow.loadFile(controllerPath);

    // Open DevTools in development
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
};

const createServer = () => {
    const appDir = isDev ? __dirname : __dirname;
    console.log("App directory:", appDir);
    console.log("Is development:", isDev);

    server = http.createServer((req, res) => {
        console.log(`Request for: ${req.url}`);

        let filePath;
        if (req.url === "/" || req.url === "/controller.html") {
            filePath = path.join(appDir, "controller.html");
        } else if (req.url === "/overlay.html") {
            filePath = path.join(appDir, "overlay.html");
        } else if (req.url.startsWith('/style.css')) {
            filePath = path.join(appDir, "style.css");
        } else if (req.url.startsWith('/images/')) {
            // Try both locations for images
            const imagePath1 = path.join(appDir, req.url);
            const imagePath2 = getResourcePath(req.url);
            filePath = fs.existsSync(imagePath1) ? imagePath1 : imagePath2;
        } else {
            filePath = path.join(appDir, req.url);
        }

        console.log(`Trying to serve file: ${filePath}`);

        const extname = String(path.extname(filePath)).toLowerCase();
        const mimeTypes = {
            ".html": "text/html",
            ".js": "application/javascript",
            ".css": "text/css",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
        };

        const contentType = mimeTypes[extname] || "application/octet-stream";

        fs.readFile(filePath, (error, content) => {
            if (error) {
                console.error(`Error reading file ${filePath}:`, error);
                res.writeHead(404);
                res.end(`File not found: ${req.url}`);
            } else {
                res.writeHead(200, { "Content-Type": contentType });
                res.end(content, "utf-8");
            }
        });
    });

    wss = new WebSocket.Server({ server });

    wss.on("connection", (ws) => {
        console.log("Client connected");
        ws.on("message", (message) => {
            console.log("Broadcasting message:", message.toString());
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        });
    });

    server.listen(3000, () => {
        console.log("Server started on http://localhost:3000");
        console.log("WebSocket server running on ws://localhost:3000");
    });
};

app.on('ready', () => {
    createServer();
    createWindow();
});

app.on('window-all-closed', () => {
    if (server) {
        server.close();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', () => {
    if (server) {
        server.close();
    }
});

// Handle app protocol for better packaged app support
if (!isDev) {
    app.setAsDefaultProtocolClient('valorant-map-ban');
}
