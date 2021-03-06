const express = require('express');
const bodyParser = require('body-parser');
const knex = require('knex');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const multer = require('multer');

// Import all endpoints
const getAllpost = require('./routes/gets');
const getAllComment = require('./routes/gets');
const getBooks = require('./routes/gets');
const getUserBooks = require('./routes/gets');
const newblog = require('./routes/post');
const comment = require('./routes/post');
const book = require('./routes/post');
const userbook = require('./routes/post');
const updataBlog = require('./routes/update');
const deletePost = require('./routes/delete');
const deleteABook = require('./routes/delete');

// Register and Sign in
const register = require('./controllers/register');
const signin = require('./controllers/signin');

//middleware
const validinfo = require('./middlewares/validinfo');
const authorization = require('./middlewares/authorization');

dotenv.config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const db = knex({
    client: 'pg',
    connection: {
        host: process.env.HOSTNAME,
        user: process.env.USERNAMEPG,
        password: process.env.PASSWORD,
        database: process.env.DATABASE,
    }
});

const app = express();

app.use(bodyParser.json());
app.use(cors());

//Set the destination and file name
let storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, '/var/www/html/profile')
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname)
    }
})

// Initialization the multer  and set up the folder which store the image
let upload = multer({ storage: storage });

app.put('/updateprofilepicture/:user_id', upload.single('photo'), async (req, res) => {

    let path = 'http://157.245.229.180/profile/' + req.file.originalname
    const { user_id } = req.params;
    const { name, email } = req.body;
    db.transaction(trx => {
        trx.where({ id: user_id })
            .update({
                picture: path,
                name: name
            })
            .into('users')
            .returning('email')
            .then(datauser => {
                return trx('newblog')
                    .returning('*')
                    .where({ email: email })
                    .update({
                        author: name,
                        picture: path,
                    })
                    .then(data => {
                        return res.status(200).json({ response: 'updated' })
                    })
            })
            .then(trx.commit)
            .catch(trx.rollback)
    })
        .catch(err => res.status(400).json({ response: "ERROR" }))

})

app.get('/allpost', (req, res) => {
    getAllpost.showAllBlogs(req, res, db);
});

app.get('/books', (req, res) => {
    getBooks.books(req, res, db);
})

app.delete('/deletebook/:delete_id', (req, res) => {
    deleteABook.deleteBook(req, res, db)
})

app.get('/allcomments', (req, res) => {
    getAllComment.showAllComments(req, res, db);
})


app.get('/userbook', (req, res) => {
    getUserBooks.getuserbooks(req, res, db);
})
app.post('/book', (req, res) => {
    book.addABook(req, res, db);
})

app.post('/useraddbooks', (req, res) => {
    userbook.userBook(req, res, db);
})

app.post('/newpost', (req, res) => {
    newblog.postNewBlog(req, res, db);
});

app.post('/comment', (req, res) => {
    comment.postComment(req, res, db);
})

app.put('/updateblog/:blog_id', (req, res) => {
    updataBlog.updatePost(req, res, db);
});

app.delete('/deleteblog/:post_id', (req, res) => {
    deletePost.deleteblog(req, res, db);
})


app.post('/register', validinfo, async (req, res) => {
    const { email } = req.body;

    try {
        const userExist = await db.select('email').from('login').where({ email: email })

        if (userExist.length > 0) {
            return res.json({ response: "User already exist" })
        }
        register.handleRegister(req, res, db, bcrypt)

    } catch (error) {
        console.error(error.message);
        res.status(400).json({ response: "error" })

    }
})

app.post('/signin', validinfo, signin.handleSignin(db, bcrypt))

app.get('/isverify', authorization, (req, res) => {
    try {
        res.json(true)
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ response: "Server Error" })
    }
})

app.get('/data', authorization, async (req, res) => {
    try {
        const user = await db.select('id', 'name', 'picture').from('users').where({ id: req.user })
        // console.log(user);
        res.json(user[0])
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ response: 'Server Error' })
    }
})

app.post('/payment', (req, res) => {
    const body = {
        source: req.body.token.id,
        amount: req.body.amount,
        currency: 'usd'
    };

    stripe.charges.create(body, (stripeErr, stripeRes) => {
        if (stripeErr) {
            res.status(500).send({ error: stripeErr })
        } else {
            res.status(200).send({ success: stripeRes })
        }
    })

})

app.listen(3001, process.env.URL, () => {
    console.log('>> App is running...');

});