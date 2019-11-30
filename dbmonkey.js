// isolate the temporary symbols so the script can re-run without collisions
(() => {

	const mdb = () => db.getSiblingDB("gymthing");
	const memberCol = mdb().member
	const eventCol = mdb().event
	const configCol = mdb().config;

	const shortId = ( prefix ) => {
		var timeTrim = 15e10; // ~47 years
		var ts = Math.floor( ( new Date().getTime() - timeTrim ) / 1000 ); // ts should cover the next ~60 years, base36 ^6
		var rnd = Math.floor( Math.random() * 46656 );  // base36 ^3
		return ( prefix || '0' ) + rnd.toString( 36 ).padStart( 3, '0' ) + ts.toString( 36 ).padStart( 6, '0' );
	}

	const makeAudit = () => {
		return {
			by: 0,
			at: new ISODate()
		}
	}

	print( "check configuration" )

	const settings = [
		{ _id: "defaultClassLimit", value: 25, description: "Default number of members that can sign up to attend a class, unless otherwise specified by that class.", audit: makeAudit() },
		{ _id: "bookAheadDays", value: 14, description: "Number of days ahead the system will generate class schedules. Members can see all class schedules that have been generated.", audit: makeAudit() },
		{ _id: "lateChangeMinutes", value: 120, description: "Minutes before a class that status changes are no longer accepted.", audit: makeAudit() },
		{ _id: "maxWaitList", value: 20, description: "Number of members that may join a waitlist for a full class.", audit: makeAudit() }
	];

	// it doesn't really matter what happens here..
	try {
		var meh = configCol.insertMany( settings, { ordered: false } );
	} catch( e ) {
		// oh noes..
	}

	print( "members: " + memberCol.count() )

	if( 0 >= memberCol.count() ) {
		print( "creating members" );
		// make members
		function makeMember( name, email, phone, apikey ) {
			return {
				_id: shortId('m'),
				name: name,
				email: email,
				phone: phone,
				api: apikey ? [ apikey ] : [],
				otk: { code: "000000", ts: new ISODate() },
				changed: makeAudit(),
				created: makeAudit()
			}
		}

		memberCol.insertMany( [
			makeMember( "Mr.Muscles", "muscles@examples.com", "+61401234567", { key: "knw0cbyo32", hash: "KQ86G/Ry+DcoTY1QMTxTUrHsoZ02obwvbYcZhOklTLw=" } ),
			makeMember( "Dr.Sporadic", "sporadic@examples.com", "+61401234567" ),
			makeMember( "Ms.Flaky", "flaky@examples.com", "+61401234567" ),
		] );
	}

	const futureEventCount = eventCol.count( { startTime: { $gt: new ISODate() } } );
	print( "futureEventCount: " + futureEventCount );

	if( 2 >= futureEventCount ) {
		print( "making more events" );
		var members = memberCol.find().limit(3).toArray();

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
				status: "confirm",
				audit: makeAudit()
			}
		}

		function makeEvent( daysInTheFuture, atHour ) {
			return {
				_id: shortId('e'),
				startTime: makeStartTime( daysInTheFuture, atHour ),
				limit: 25,
				attendees: [
					makeAttendee( 0 ),
					makeAttendee( 1 ),
					makeAttendee( 2 ),
				],
				sourceId: null,
				created: makeAudit()
			}
		}

		eventCol.insertMany( [
			makeEvent( 1, 6 ),
			makeEvent( 1, 7 ),
			makeEvent( 1, 9 ),
			makeEvent( 2, 7 ),
			makeEvent( 2, 8 ),
			makeEvent( 5, 7 ),
		])
	}

// close isolation block and execute
})();
