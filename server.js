const express = require('express');
const app = express();
const path = require('path');
const livereload = require("livereload");
const connectLivereload = require("connect-livereload");

const PORT = process.env.PORT || 3000;

// Setup livereload in development mode
if (process.env.NODE_ENV !== 'production') {
    const liveReloadServer = livereload.createServer();
    liveReloadServer.watch(path.join(__dirname, 'public'));
    
    // Ping browser on server restart
    liveReloadServer.server.once("connection", () => {
        setTimeout(() => {
            liveReloadServer.refresh("/");
        }, 100);
    });

    app.use(connectLivereload());
}

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
