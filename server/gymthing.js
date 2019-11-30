var express = require( 'express' );
var app = express();
var fs = require( 'fs' );
var crypto = require('crypto');
const mdburl = "mongodb://localhost:27017/gymthing";
var MongoClient = require( 'mongodb' ).MongoClient;

/*
 * utilities
 */
const i22s = function( i ) {
	return i >= 10 ? "" + i : "0" + i;
}
const atob = function( b64enc ) {
	return Buffer.from( b64enc, 'base64' ).toString();
}
const shortId = function( prefix ) {
	var timeTrim = 1500000000000; // ~47 years
	var ts = Math.floor( ( new Date().getTime() - timeTrim ) / 100 ); // ts should cover the next 690 years, base36 ^ 6
	var rnd = Math.floor( Math.random() * 46656 );  // base36 ^3
	return ( prefix || "0" ) + rnd.toString( 36 ).padStart( 3, '0' ) + ts.toString( 36 ).padStart( 6, '0' );
}
const cyptoHash = function( key, pwd ) {
	return crypto.createHash( 'sha256' ).update( key ).update( pwd ).digest( 'base64' );
}

var mdb = {
	client: new MongoClient( mdburl, { useUnifiedTopology: true, appname: "GymThing" } ),
	db: null,
	memberCol: function() { return this.db.collection( "member" ); },
	eventCol: function() { return this.db.collection( "event" ); }
}

var ISO8601 = {
	dateString: function( dateObj ) {
		var d = dateObj || new Date();
		return "" + d.getFullYear() + "-" + i22s( d.getMonth() + 1 ) + "-" + i22s( d.getDate() );
	},
	timeString: function( dateObj ) {
		var d = dateObj || new Date();
		return i22s( d.getHours() ) + ":" + i22s( d.getHours() ) + ":" + i22s( d.getSeconds() );
	}
};

var reqAssert = function( req, res ) {
	if( !mdb.db ) {
		res.status( 500 ).json( { message: 'database bad' } );
		return false;
	}
	return true;
}

/* basic authenticate HTTP request
 * calls reqAssert first to ensure it's possible
 * will respond to 'res' automatically
 * calls cb with the member doc if it checks out
 */
var reqAuthenticate = function( req, res, cb ) {
	if( reqAssert( req, res ) ) {
		if( !req.headers.authorization || -1 === req.headers.authorization.indexOf( 'Basic ' ) ) {
			res.status( 401 ).json( { message: 'Missing Authorization Header' } );
		}
		const credentials = atob( req.headers.authorization.split(' ')[1] );
		console.log( credentials );
		const [username, password] = credentials.split( ':' );

		console.log( "gonna look for api key: " + username );

		mdb.memberCol().find( { "api.key": username } ).project( { name: 1, 'api.$': 1 } ).limit( 1 ).toArray( function( err, memberset ) {
			if( !err && memberset && 0 < memberset.length ) {
				var member = memberset[0];
				console.log( "found user: " + member.name );
				var hash = cyptoHash( username, password );
				if( member.api[0].hash == hash ) {
					cb( { _id: member._id, name: member.name } );
					return;
				}
				console.log( "invalid hash: %s != %s", hash, member.api[0].hash );
			}
			// dropping out for some sort of auth failure.. slow it down a little
			setTimeout( function() {
				res.status( 401 ).json( { message: 'Invalid Authentication Credentials' } );
			}, 1000 );
		} );
	}
}

/* GET test */
app.get( '/test', function( req, res ) {
	console.log( 'GET /test' );
	var muscles = { key: "knw0cbyo32", pwd: "00000000-0000-4000-0000-000000000000" };
	muscles.hash = crypto.createHash( 'sha256' ).update( muscles.key ).update( muscles.pwd ).digest( 'base64' );
	var testDoc = {
		rawTime: new Date().getTime(),
		localeTime: new Date().toString(),
		date: ISO8601.dateString(),
		time: ISO8601.timeString(),
		shortId0: shortId(),
		shortId1: shortId( '1' ),
		muscles: muscles
	}
	res.json( testDoc );
} );

/*
 * eventList GET
 */
app.get( '/eventList', function( req, res ) {
	console.log( 'GET /eventList' );
	reqAuthenticate( req, res, function( memberDoc ) {
		var selfId = memberDoc._id;
		var pipeline = [
			{ '$match': { 'startTime': { '$gt': new Date() } } },
			{ '$sort': { 'startTime': 1 } },
			{ '$group': {
				_id: { '$dateToString': { date: '$startTime', format: '%Y-%m-%d' } },
				event: { '$push': {
					eventId: '$_id',
					time: { '$dateToString': { date: '$startTime', format: '%H:%M' } },
					memberCount: { '$size': '$attendees' },
					memberLimit: '$limit',
					selfStatus: { '$let': {
						vars: { fa: { '$filter': { input: '$attendees', as: 'm', cond: { '$eq': [ selfId, '$$m.memberId' ] } } } },
						in: { '$cond': [ { '$gt': [ { '$size': '$$fa' }, 0 ] }, { '$arrayElemAt': ['$$fa.status',0] }, null ] }
					} },
					repeats: { '$gt': [ '$sourceId', null ] }
				} }
			} },
			{ '$project': { date: '$_id', event: 1, _id: 0 } }
		];
		mdb.eventCol().aggregate( pipeline, function( err, cursor ) {
			if( err ) {
				res.status( 500 ).json( { message: "pipeline execution pooped: " + err } );
				return;
			}
			cursor.toArray( function( err, docs ) {
				if( err ) {
					res.status( 500 ).json( { message: "pipeline cursor.toArray pooped: " + err } );
					return;
				}
				res.json( docs );
			} )
		} )
	} )
} );

/*
 * event/:eventId PUT
 */
app.put( '/event/:eventId', function( req, res ) {
	console.log( 'PUT /event/:eventId' );
	reqAuthenticate( req, res, function( memberDoc ) {
		console.log( JSON.stringify( req.body ) );
	} );
} );

/*
 * debug page at the root
 */
app.get( '/', function( req, res ) {
	console.log( 'GET /' );
	fs.readFile( "debug.html", function( err, data ) {
		if( err ) {
			res.status( 500 ).json( { message: "readfile pooped: " + err } );
			return;
		}
		res.writeHead( 200, { 'Content-Type': 'text/html' } );
		res.write( data );
		res.end();
	} );
} );

/*
 * server
 */
var server = app.listen( 2000, "127.0.0.1", function() {
	var host = server.address().address;
	var port = server.address().port;
	console.log( "app listening at http://%s:%s", host, port );
	mdb.client.connect( function( err, mc ) {
		if( err ) { throw err; }
		console.log( "connected to db at %s", mdburl );
		mdb.db = mdb.client.db( "gymthing" );
	} );
} );
