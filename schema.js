Audit() = {
	by: Trainer()._id,
	at: ISODate()
}

Member() = {
	_id: UUID(),
	name: "Firstname Surname",
	email: "first.surname@some.domain.com",
	phone: "+61401234567",
	keys: [
		{ evidence: Binary(), salt: Binary() }
	],
	otk: { code: Integer(), ts: ISODate() }, // field present only during new device discovery
	changed: Audit(),
	created: Audit()
}

AttendStatus() = [
	"confirmed", // signed up
	"waiting",   // on the wait list
	"present",   // after/during class, got marked as present - this is not recorded in recurring events
	"cancelled"  // was signed up ('confirmed') but withdrew before the cutoff - this is not recorded in recurring events
]

Trainer() = {
	_id: UUID(),
	name: "Master Trainer",
	isAdmin: Boolean(),
	pwd: { evidence: "", salt: "" }
}

ClassAttendanceElement() = {
	memberId: Member()._id,
	name: Member().name,
	status: AttendStatus(),
	changed: Audit()
}

Class() = {
	_id: UUID(),
	startTime: ISODate(),
	limit: Integer(),
	attendees: [ ClassAttendanceElement() ],
	sourceId: Class()._id, // only null for source events
	created: Audit()
}

GlobalVariableName() = [
	"defaultClassLimit",	// integer > 0
	"bookAheadDays",		// integer > 0
	"lateCancelMinutes",	// integer >= 0; minutes before class that cancellations are no longer accepted
	"maxWaitList",			// integer >= 0; maximum waitlist length
]

Global() = {
	_id: GlobalVariableName(),
	value: Integer(),
	changed: Audit()
}

/*
 * SOME NOTEWORTHY THINGS
  - Member() documents are largely static
  - A Class() document represents either an instance or a recurring program
  - Members can sign up only to an instance, but can request to 'recur' which will also add them to all future events going forward as possible
  - At this time there is no way to specify a recurring class cadence; it's assumed to be weekly
  - eg. 9:30AM class occurring every weekday means having 5 recurring classes here
 */
