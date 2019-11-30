var express = require( "express" );
var app = express();
var fs = require( "fs" );
var crypto = require("crypto");
const mdburl = "mongodb://localhost:27017/gymthing";
var MongoClient = require( "mongodb" ).MongoClient;

// @todo: limit config value reloads
const configValuesReloadMinimumSeconds = 10

/*
 * utilities
 */
const shortId = ( prefix, tsDate ) => {
	var timeTrim = 15e10; // ~47 years
	var ts = Math.floor( ( ( tsDate || new Date() ).getTime() - timeTrim ) / 1000 ); // ts should cover the next ~60 years, base36 ^6
	var rnd = Math.floor( Math.random() * 46656 );  // base36 ^3
	return ( prefix || "0" ) + rnd.toString( 36 ).padStart( 3, "0" ) + ts.toString( 36 ).padStart( 6, "0" );
}
const cyptoHash = ( key, pwd ) => crypto.createHash( "sha256" ).update( key ).update( pwd ).digest( "base64" );

Date.prototype.addDays = function( days ) {
    var date = new Date( this.valueOf() );
    date.setDate( date.getDate() + days );
    return date;
}

const ISO8601 = {
	dateString: ( dateObj ) => {
		var d = dateObj || new Date();
		return d.toISOString().substring( 0, 10 );
	},
	timeString: ( dateObj ) => {
		var d = dateObj || new Date();
		return d.toISOString().substring( 11, 11+8 );
	}
};

/***********************************************************************************
 * MongoDB
 */

const mdb = (function() {
	const client = new MongoClient( mdburl, { useUnifiedTopology: true, appname: "GymThing" } );
	var db = null;
	const member = () => db.collection( "member" );
	const event = () => db.collection( "event" );
	const config = () => db.collection( "config" );
	return {
		connect: function() {
			client.connect( ( err, mc ) => {
				if( err ) {
					console.log( "dafuq I do wit dis.." + err.toString() );
					throw err;
				}
				console.log( "connected to db at %s", mdburl );
				db = client.db( "gymthing" );
			} );
		},
		isConnected: function() {
			return client.topology.isConnected();
		},
		getConfigValue: function( id, cb ) {
			config().find( { _id: id } ).project( { _id: 0, value: 1 } ).limit( 1 ).toArray( ( err, docArray ) => {
				if( err ) {
					console.log( "ERROR: getConfigValue: " + err.toString() );
				}
				cb( ( err || 1 != docArray.length ) ? null : docArray[0].value );
			} )
		},
		getMemberFromKey: function( apikey, cb ) {
			console.log( "gonna look for api key: " + apikey );
			member().find( { "api.key": apikey } ).project( { "name": 1, "api.$": 1 } ).limit( 1 ).toArray( ( err, memberset ) => {
				if( err ) {
					console.log( "ERROR: getUserFromKey: " + err.toString() );
					cb( null );
				}
				else if( !memberset || 1 != memberset.length ) {
					console.log( "ERROR: getUserFromKey found non-unity users [%s] count [%i]", apikey, memberset.length );
					cb( null );
				}
				else {
					const m = memberset[0];
					console.log( "found user: " + m.name );
					cb( { _id: m._id, name: m.name, hash: m.api[0].hash } );
				}
			} );
		},
		getEventList: function( selfId, dateStart, dateLimit, cb ) {
			const pipeline = [
				{ "$match": { "startTime": { "$gt": dateStart, "$lt": dateLimit } } },
				{ "$sort": { "startTime": 1 } },
				{ "$group": {
					_id: { "$dateToString": { date: "$startTime", format: "%Y-%m-%d" } },
					event: { "$push": {
						eventId: "$_id",
						time: { "$dateToString": { date: "$startTime", format: "%H:%M" } },
						memberCount: { "$size": "$attendees" },
						memberLimit: "$limit",
						selfStatus: { "$let": {
							vars: { fa: { "$filter": { input: "$attendees", as: "m", cond: { "$eq": [ selfId, "$$m.memberId" ] } } } },
							in: { "$cond": [ { "$gt": [ { "$size": "$$fa" }, 0 ] }, { "$arrayElemAt": ["$$fa.status",0] }, null ] }
						} },
						repeats: { "$gt": [ "$sourceId", null ] }
					} }
				} },
				{ "$project": { date: "$_id", event: 1, _id: 0 } }
			];
			console.log( JSON.stringify( pipeline ) );
			event().aggregate( pipeline ).toArray( ( err, docs ) => {
				if( err ) {
					console.log( "aggregation failed: " + err.toString() );
					cb( null );
				}
				else {
					cb( docs );
				}
			} )
		},
		getEvent: function( selfId, eventId, cb ) {
			const pipeline = [
				{ "$match": { _id: eventId } },
				{ "$project": { _id: 0,
					startTime: 1,
					memberCount: { "$size": "$attendees" },
					memberLimit: "$limit",
					selfStatus: { "$let": {
						vars: { fa: { "$filter": { input: "$attendees", as: "m", cond: { "$eq": [ selfId, "$$m.memberId" ] } } } },
						in: { "$cond": [ { "$gt": [ { "$size": "$$fa" }, 0 ] }, { "$arrayElemAt": ["$$fa.status",0] }, null ] }
					} },
					sourceId: 1
				} }
			];
			event().aggregate( pipeline ).toArray( ( err, docArray ) => {
				if( err ) {
					console.log( "ERROR: getEvent [%s,%s]: %s", selfId, eventId, err.toString() );
					cb( null );
				}
				else if( 1 != docArray.length ) {
					console.log( "getEvent: no such event [%s,%s]", selfId, eventId );
					cb( null );
				}
				else {
					cb( docArray[0] );
				}
			} );
		}
	}
})();

/**********************************************************************************/

const reqAssert = ( req, res ) => {
	if( !mdb.isConnected() ) {
		res.status( 503 ).json( { ok: false, message: "Database connection is down" } );
		return false;
	}
	return true;
}

const reqParseAuthHeader = ( req ) => {
	const authhead = req.headers.authorization;
	if( !authhead || -1 === authhead.indexOf( "Basic " ) ) {
		return [null,null];
	}
	const creds = Buffer.from( authhead.split(" ")[1], "base64" ).toString();
	//console.log( creds );
	return creds.split( ":" );
}

/* basic authenticate HTTP request
 * calls reqAssert first to ensure it's possible
 * calls cb with the member doc only if it checks out
 * otherwise will respond to 'res' with an error after a short delay
 */
const reqAuthenticate = ( req, res, cb ) => {
	if( reqAssert( req, res ) ) {
		const [username, password] = reqParseAuthHeader( req );
		if( !username || !password ) {
			res.status( 401 ).json( { ok: false, message: "Missing authorization header" } );
			return;
		}
		mdb.getMemberFromKey( username, member => {
			if( member ) {
				var hash = cyptoHash( username, password );
				if( member.hash == hash ) {
					cb( { _id: member._id, name: member.name } );
					return;
				}
				console.log( "invalid hash: %s != %s", hash, member.hash );
			}
			// dropping out for some sort of auth failure.. make them wait a second
			setTimeout( () => res.status( 401 ).json( { ok: false, message: "Authentication failure" } ), 1000 );
		} );
	}
}

const reqJsonBody = ( req, res, limit, cb ) => {
	var body = "";
	req.on( "data", data => {
		body += data;
		if( body.length > limit ) {
			req.status( 413 ).json( { ok: false, message: "Woah!" } );
			return;
		}
	} );
	req.on( "end", () => {
		var json = null;
		try {
			json = JSON.parse( body );
			console.log( JSON.stringify( json ) );
		}
		catch( ex ) {
			res.status( 400 ).json( { ok: false, message: "Content didn't make sense" } );
			return;
		}
		cb( json );
	} );
}

/***********************************************************************************
 * API
 */

/*
 * test GET
 */
app.get( "/test", ( req, res ) => {
	console.log( "GET /test" );
	var muscles = { key: "knw0cbyo32", pwd: "00000000-0000-4000-0000-000000000000" };
	muscles.hash = crypto.createHash( "sha256" ).update( muscles.key ).update( muscles.pwd ).digest( "base64" );
	var testDoc = {
		rawTime: new Date().getTime(),
		localeTime: new Date().toString(),
		date: ISO8601.dateString(),
		time: ISO8601.timeString(),
		shortId0: shortId(),
		shortId1: shortId( "1" ),
		muscles: muscles
	}
	res.json( testDoc );
} );

/*
 * eventList GET
 */
app.get( "/eventList", ( req, res ) => {
	console.log( "GET /eventList" );
	reqAuthenticate( req, res, memberDoc => {
		mdb.getConfigValue( "bookAheadDays", bookAheadDays => {
			if( 'number' != typeof bookAheadDays ) {
				res.status( 503 ).json( { ok: false, message: "Database gave nonsense global setting" } );
			}
			else {
				const dateStart = new Date();
				const dateLimit = dateStart.addDays( bookAheadDays );
				mdb.getEventList( memberDoc._id, dateStart, dateLimit, eventList  => {
					if( !eventList ) {
						res.status( 503 ).json( { ok: false, message: "Database aggregator failed" } );
					}
					else {
						res.json( eventList );
					}
				} );
			}
		} );
	} );
} );

/*
 * event/:eventId POST
 * { status: AttendStatus(), allRepeatEvents: Boolean }
 */
app.post( "/event/:eventId", ( req, res ) => {
	console.log( "POST /event/%s", req.params.eventId );
	reqAuthenticate( req, res, memberDoc => {
		console.log( "auth-success" )
		reqJsonBody( req, res, 1024, json => {
			const eventId = req.params.eventId;
			const status = json.status;
			const allRepeatEvents = json.allRepeatEvents;
			if( !["confirmed","waiting","cancel"].contains( status ) ) {
				res.status( 400 ).json( { ok: false, message: "Need a status param of confirmed, waiting, or cancel" } );
				return;
			}
			// check if we're inside the freeze window
			mdb.getConfigValue( "lateChangeMinutes", lateChangeMinutes => {
				if( 'number' != typeof lateChangeMinutes ) {
					res.status( 503 ).json( { ok: false, message: "Database gave nonsense global setting" } );
					return;
				}
				mdb.getEvent( memberDoc._id, eventId, event => {
					if( !event ) {
						res.status( 404 ).json( { ok: false, message: "Event does not exist" } );
						return;
					}
					if( new Date().getTime() + ( lateChangeMinutes * 60 * 1000 ) > event.startTime.getTime() ) {
						res.status( 400 ).json( { ok: false, message: "Unable to change status within " + lateChangeMinutes + " minutes of the event" } );
						return;
					}

					// TODO: compare to doc after locating

					// blind attempt to update on params and see what happens
					// mdb...

					res.json( { ok: true, result: { eventId: eventId, status: status } } );
				} );
			} );
		} );
	} );
} );

/*
 * debug page at the root
 */
app.get( "/", ( req, res ) => {
	console.log( "GET /" );
	fs.readFile( "debug.html", ( err, data ) => {
		if( err ) {
			res.status( 500 ).json( { ok: false, message: "Readfile fail", sourceError: err } );
			return;
		}
		res.writeHead( 200, { "Content-Type": "text/html" } );
		res.write( data );
		res.end();
	} );
} );

/*
 * server
 */
var server = app.listen( 2000, "127.0.0.1", () => {
	console.log( "app listening at http://%s:%s", server.address().address, server.address().port );
	mdb.connect();
} );
