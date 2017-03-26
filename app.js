//Module dependencies.
var express = require('express');
var http = require('http');
var passport = require('passport');
var path = require('path');
var LocalStrategy = require('passport-local').Strategy;
var mongoose = require('mongoose');
var socketio = require('socket.io');
var ejs = require('ejs');
var CircularJSON = require('circular-json');

var config = require("./crypto.json");
var Product = require("./Product.js");


//Load Necessary Config Files
var node_algorithm = config["algorithm"];
var node_password = config["password"];
var node_secret = config["secret"];

//AES256 Crypto Functions
var crypto = require('crypto'),
    algorithm = node_algorithm,
    password = node_password;

function encrypt(text) {
    var cipher = crypto.createCipher(algorithm, password)
    var crypted = cipher.update(text, 'utf8', 'hex')
    crypted += cipher.final('hex');
    return crypted;
}

function decrypt(text) {
    var decipher = crypto.createDecipher(algorithm, password)
    var dec = decipher.update(text, 'hex', 'utf8')
    dec += decipher.final('utf8');
    return dec;
}

//Connect to Database
mongoose.connection.on('open', function(ref) {
    console.log('Connected to mongo server.');
});
mongoose.connection.on('error', function(err) {
    console.log('Could not connect to mongo server!');
    console.log(err);
});
mongoose.connect('mongodb://localhost/Vamos');
var Schema = mongoose.Schema;

// all environments
var app = express();
app.use(require('express-session')({
    key: 'session',
    secret: node_secret,
    city: '',
    region: '',
    store: require('mongoose-session')(mongoose)
}));
app.set('port', process.env.PORT || 80);
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);
app.use(express.static(__dirname + '/public'));
var sess;

// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

//User Schema
var UserDetail = new Schema({
    username: String,
    password: String,
    type: String
}, {
    collection: 'userInfo'
});

//Create MongoDB models
var UserDetails = mongoose.model('userInfo', UserDetail);

//Handle User Sessions
passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

//Verify Login with User Schema
passport.use(new LocalStrategy(
    function(username, password, done) {

        process.nextTick(function() {
            UserDetails.findOne({
                    'username': username
                },
                function(err, user) {
                    if (err) {
                        return done(err);
                    }
                    if (!user) {
                        return done(null, false);
                    }
                    if (user.password != encrypt(password)) {
                        return done(null, false);
                    }
                    return done(null, user);
                });
        });
    }
));

/////////////////////////
// Handle Page Routing //
/////////////////////////

app.get('/login', function(req, res, next) {
    if (req.user) {
        res.redirect('/admin');
    } else {
      res.render('pages/login', {page_name:"login", fail: false});
    }
});

app.get('/loginfailed', function(req, res, next) {
    if (req.user) {
        res.redirect('/admin');
    } else {
      res.render('pages/login', {page_name:"login", fail: true});
    }
});

app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/'); //Can fire before session is destroyed?
});

app.get('/', function(req, res, next) {
    sess = req.session;
    res.render('pages/index', {page_name:"home"});
});

app.get('/browser', function(req, res, next) {
    if (req.user) {
      res.render('pages/browser',  {page_name:"browse"});
    }
    else{
    res.redirect('/login'); //Can fire before session is destroyed?
    }
});


// Routing for Products
app.get('/productlist', function(req, res){
    // Should list all products... for testing
    var productDetail = Product.productDetail
    // console.log(Product.toString);
    ProductTest = mongoose.model('productInfo', productDetail);
    console.log("Display all products")
    
    
    products = ProductTest.find(function(err, products){
        if(err) return console.log(err);
        var productJSON = []
        products.forEach(function(product) {
            console.log( product.productName );
            console.log( product.productDesc );
            console.log( product.productId );
            console.log( "-----------------------------\n" );
            
            productJSON.push({
                "productName": product.productName,
                "productDesc": product.productDesc,
                "productId": product.productId,
                "productImage": path.join(__dirname, '/listing_images/') + product.productImage
            });

        }); // foreach
        res.json( productJSON );
    })
});

// Retreive a single Product
app.get('/product/:id', function(req, res){
    var productDetail = Product.productDetail
    ProductTest = mongoose.model('productInfo', productDetail);

    ProductTest.find({ productId: req.params.id}, function(err, product){
        if(err) return handlError(err);
        if (product.length == 0) return res.send("Error 404: No quote found.");
        var result = {
            "productName": product[0].productName,
            "productDesc": product[0].productDesc,
            "productId": product[0].productId
        }
        
        console.log("Product " + req.params.id + " found!");
        console.log(product);
        res.json( result );
   });
});

app.post('/product', function(req, res){
    if(!req.body.hasOwnProperty('name') ||
        !req.body.hasOwnProperty('desc')){

        res.statusCode = 400;
        return res.send('Error 400: Post syntax incorrect.');
    }

    var newProduct = {
        "name": req.body.name,
        "desc": req.body.desc
    };
    // var CreateProduct = Product.createProduct

    Product.createProduct( newProduct );
    res.redirect('/productlist');
    // res.end("Added");

});

app.delete('/product/:id', function(req, res){
   var productDetail = Product.productDetail
   
   ProductTest = mongoose.model('productInfo', productDetail);
   ProductTest.remove({ productId: req.params.id}, function(err){
        if(err) return handlError(err);
        console.log("Product " + req.params.id + " removed!");
   });
   // console.log("debug0");
   res.end("Ended");
});


app.post('/auth',
    passport.authenticate('local', {
        successRedirect: '/admin',
        failureRedirect: '/loginfailed'
    }));

//Create Server Instance on Defined Port
var server = http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});
