import { stringify } from "querystring"

Audit() = {
	by: Trainer()._id,
	at: ISODate()
}

MemberId() = String() // 10 characters, shortId prefix 'm'

KeyId() = String() // 10 characters, shortId prefix 'k'

Member() = {
	_id: MemberId(),
	name: "Firstname Surname",
	email: "first.surname@some.domain.com",
	phone: "+61401234567",
	api: [
		{ key: KeyId(), pwd: UUIDv4() }
	],
	otk: { code: Integer(), ts: ISODate() }, // field present only during new device discovery
	changed: Audit(),
	created: Audit()
}

AttendStatus() = [
	"confirmed",// signed up
	"waiting", 	// on the wait list
	"present",  // after/during class, got marked as present - this is not recorded in recurring events
	"cancel"  	// was previously 'confirmed', this is only for actions, it is not otherwise recorded
]

TrainerId() = String() // 10 characters, shortId prefix 't'

Trainer() = {
	_id: TrainerId(),
	name: "Master Trainer",
	isAdmin: Boolean(),
	pwd: { evidence: "", salt: "" }
}

EventAttendanceElement() = {
	memberId: Member()._id,
	name: Member().name,
	status: AttendStatus(),
	changed: Audit()
}

EventId() = String() // 10 characters, shortId prefix 'e'

Event() = {
	_id: EventId(),
	startTime: ISODate(),
	limit: Integer(),
	attendees: [ EventAttendanceElement() ],
	sourceId: Event()._id, // only null for source events
	created: Audit()
}

GlobalVariableName() = [
	"defaultClassLimit",	// integer > 0
	"bookAheadDays",		// integer > 0
	"lateChangeMinutes",	// integer >= 0; minutes before class that status changes are no longer accepted
	"maxWaitList",			// integer >= 0; maximum waitlist length
]

Global() = {
	_id: GlobalVariableName(),
	value: Integer(),		// all currently defined globals are integers
	description: String(), 	// display description of the purpose for this variable
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
