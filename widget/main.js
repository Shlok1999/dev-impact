const { app, BrowserWindow, ipcMain, screen } = require('electron');

let win;

function createWindow() {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    
    const miniWidth = 280;
    const miniHeight = 60;
    
    win = new BrowserWindow({
        width: miniWidth,
        height: miniHeight,
        x: screenWidth - miniWidth - 20,
        y: screenHeight - miniHeight - 20,
        alwaysOnTop: true,
        frame: false,
        transparent: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })
    win.loadFile('index.html')
}

function getPositions(isExpanded) {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    const width = isExpanded ? 450 : 280;
    const height = isExpanded ? 480 : 60;
    return {
        width,
        height,
        x: screenWidth - width - 20,
        y: screenHeight - height - 20
    };
}

ipcMain.on('resize-window', (event, { expanded }) => {
    if (win) {
        const { width, height, x, y } = getPositions(expanded);
        win.setSize(width, height);
        win.setPosition(x, y);
    }
});

app.whenReady().then(createWindow)
