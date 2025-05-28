const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require("http");
const fs = require("fs");
const WebSocket = require("ws");

let mainWindow;
let server;
let wss;

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 500,
        height: 750,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.loadFile('controller.html');

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
};

const createServer = () => {
    // Debug: List files in the current directory
    console.log("Files in app directory:", fs.readdirSync(__dirname));

    server = http.createServer((req, res) => {
        console.log(`Request for: ${req.url}`);

        // Use __dirname to get the actual app directory
        let filePath;
        if (req.url === "/" || req.url === "/controller.html") {
            filePath = path.join(__dirname, "controller.html");
        } else if (req.url === "/overlay.html") {
            filePath = path.join(__dirname, "overlay.html");
        } else if (req.url.startsWith('/style.css')) {
            filePath = path.join(__dirname, "style.css");
        } else if (req.url.startsWith('/images/')) {
            filePath = path.join(__dirname, req.url);
        } else {
            // Handle other static files
            filePath = path.join(__dirname, req.url);
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
