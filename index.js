
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');
const multer = require('multer');
const { exec } = require('child_process');
require('dotenv').config()
const app = express();
app.use(express.json());

// MongoDB Connection

const uri = `mongodb+srv://${process.env.db_users}:${process.env.db_pass}@cluster0.yk6uldw.mongodb.net/?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


// Multer Configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    },
});

const upload = multer({ storage: storage });

// Authentication Middleware
function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    jwt.verify(token, process.env.access_token_secret, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

// Routes
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const collection = db.collection('users');
    const user = await collection.findOne({ username });

    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, process.env.access_token_secret, {
        expiresIn: '1h',
    });

    res.json({ token });
});
app.post('/code', authenticateToken, upload.single('file'), async (req, res) => {
    const { code } = req.body;
    const file = req.file;

    if (!code && !file) {
        return res.status(400).json({ message: 'No code provided' });
    }

    let codeFilePath;
    if (file) {
        codeFilePath = file.path;
    } else {
        // Collection name for code snippets
        const collectionName = 'snippets';
        const collection = db.collection(collectionName);

        // Route to create a new code snippet
        app.post('/snippets', (req, res) => {
            const { name, code } = req.body;

            // Insert the code snippet into the collection
            collection.insertOne({ name, code }, (error) => {
                if (error) {
                    console.error('Failed to insert code snippet:', error);
                    res.status(500).json({ message: 'Failed to create code snippet.' });
                } else {
                    res.status(201).json({ message: 'Code snippet created successfully.' });
                }
            });
        });

        // Route to retrieve a code snippet by name
        app.get('/snippets/:name', (req, res) => {
            const { name } = req.params;

            // Find the code snippet in the collection
            collection.findOne({ name }, (error, snippet) => {
                if (error) {
                    console.error('Failed to retrieve code snippet:', error);
                    res.status(500).json({ message: 'Failed to retrieve code snippet.' });
                } else if (snippet) {
                    res.json(snippet);
                } else {
                    res.status(404).json({ message: 'Code snippet not found.' });
                }
            });
        });
    }

    // Execute code in a secure sandbox environment
    exec('node ' + codeFilePath, (error, stdout, stderr) => {
        if (error) {
            console.error(`Code execution error: ${error.message}`);
            return res.status(500).json({
                message: 'Code execution failed',
                error: error.message,
            });
        }
        if (stderr) {
            console.error(`Code execution error: ${stderr}`);
            return res.status(500).json({
                message: 'Code execution failed',
                error: stderr,
            });
        }
        res.json({ result: stdout });
    });
});

// Start the server

app.get('/', (req, res) => {
    res.send('server is running');
})

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
