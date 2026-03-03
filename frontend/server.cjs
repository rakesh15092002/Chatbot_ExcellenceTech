const express = require('express');
const path = require('path');
const app = express();
const port = 9055;
app.use(express.static(path.join(__dirname, 'dist')));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
app.listen(port, '0.0.0.0', () => {
  console.log('Server is running on port 9055');
});
