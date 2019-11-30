var memc = db.member
var evtc = db.event

var shortId = function( prefix ) {
	var timeTrim = 1500000000000; // ~47 years
	var ts = Math.floor( ( new Date().getTime() - timeTrim ) / 100 ); // ts should cover the next 690 years, base36 ^ 6
	var rnd = Math.floor( Math.random() * 46656 );  // base36 ^3
	return ( prefix || '0' ) + rnd.toString( 36 ).padStart( 3, '0' ) + ts.toString( 36 ).padStart( 6, '0' );
}

function uuidToString( uuid ) {
	uuid = uuid || new UUID();
	return uuid.toString().substring(6,42);
}

function makeAudit() {
	return {
		by: 0,
		at: new ISODate()
	}
}

if( 0 >= memc.count() ) {
	print( "making members" );
	/* make members */
	function makeMember( name, email, phone, apikey ) {
		return {
			_id: shortId('m'),
			name: name,
			email: email,
			phone: phone,
			api: apikey ? [ apikey ] : [],
			otk: { code: "000000", ts: new ISODate() },
			changed: audit,
			created: audit
		}
	}

	memc.insertMany( [
		makeMember( "Mr.Muscles", "muscles@examples.com", "+61401234567", { key: "knw0cbyo32", hash: "KQ86G/Ry+DcoTY1QMTxTUrHsoZ02obwvbYcZhOklTLw=" } ),
		makeMember( "Dr.Sporadic", "sporadic@examples.com", "+61401234567" ),
		makeMember( "Ms.Flaky", "flaky@examples.com", "+61401234567" ),
	] );
}

if( 0 >= evtc.count() ) {
	print( "making events" );
	var members = memc.find().limit(3).toArray();

	function makeStartTime( daysInTheFuture, atHour ) {
		var fd = new ISODate();
		fd.setDate( fd.getDate() + daysInTheFuture );
		fd.setHours( atHour );
		fd.setMinutes( 0 );
		fd.setSeconds( 0 );
		fd.setMilliseconds( 0 );
		return fd;
	}

	function makeAttendee( ordinal ) {
		return {
			memberId: members[ordinal]._id,
			name: members[ordinal].name,
			status: "confirmed",
			audit: audit
		}
	}

	function makeEvent( daysInTheFuture, atHour ) {
		return {
			_id: shortId('e'),
			startTime: makeStartTime( daysInTheFuture, atHour ),
			limit: 35,
			attendees: [
				makeAttendee( 0 ),
				makeAttendee( 1 ),
				makeAttendee( 2 ),
			],
			sourceId: null,
			created: audit
		}
	}

	evtc.insertMany( [
		makeEvent( 1, 6 ),
		makeEvent( 1, 7 ),
		makeEvent( 1, 9 ),
		makeEvent( 2, 7 ),
		makeEvent( 2, 8 ),
		makeEvent( 5, 7 ),
	])
}
