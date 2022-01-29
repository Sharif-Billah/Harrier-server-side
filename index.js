const express = require('express');
const app = express();
const cors = require('cors');
const admin = require("firebase-admin");
require('dotenv').config();
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;

const { config } = require('dotenv');

const port = process.env.PORT || 8000;

const serviceAccount = require('./harrier-8decd-firebase-adminsdk.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2jmei.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }
    }
    next();
}

async function run() {
    try {
        await client.connect();
        const database = client.db('harrier');
        const productsCollection = database.collection('products');
        const ordersCollection = database.collection('orders');
        const usersCollection = database.collection('users');


        // get api
        app.get('/products', async (req, res) => {
            const cursor = productsCollection.find({});
            const products = await cursor.toArray();
            res.send(products);
        })


        // app.get('/orders', verifyToken, async (req, res) => {
        //     const email = req.query.email;
        //     const query = { email: email };
        //     console.log(query);
        //     const cursor = ordersCollection.find(query);
        //     const orders = await cursor.toArray();
        //     res.json(orders);
        // })

        app.get('/orders', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            console.log(query);
            const cursor = ordersCollection.find(query);
            const orders = await cursor.toArray();
            res.json(orders);
        })


        //     const cursor = ordersCollection.find({});
        //     const orders = await cursor.toArray();
        //     res.send(orders);
        // })

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin })
        })


        //get single product
        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            console.log('getting specipic product', id);
            const query = { _id: ObjectId(id) };
            const product = await productsCollection.findOne(query);
            res.json(product);
        })

        // post api
        app.post('/products', async (req, res) => {
            const product = req.body;
            console.log('hit the post api', product);
            const result = await productsCollection.insertOne(product);
            console.log(result);

            res.json(result);


        });

        app.post('/orders', async (req, res) => {
            const order = req.body;
            console.log(order);
            const result = await ordersCollection.insertOne(order)
            res.json({ result })
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user)
            console.log(result);
            res.json(result)
        })

        // put
        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        })

        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result)
                }
            }
            else {
                res.status(403).json({ message: 'you do not have access to make admin' })
            }
        })
    }
    finally {
        // await client.close();
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('running harrier');
})

app.listen(port, () => {
    console.log(`runing server on port, ${port}`);
})