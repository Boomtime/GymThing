## Types
`EventId()` = 10 character event identity as string
`Date()` = ISO-8601 date string, YYYY-MM-DD  
`Time()` = ISO-8601 time string, HH:MM  
`MemberStatus()` = enum 'confirm', 'waiting', or null  
`Number()` = standard JSON number but is not expected to ever have a decimal point  

## HTTP codes
### 400
GET/POST parameter error, method specific

### 401
credentials are malformed or can't authenticate

### 404
method doesn't exist, may also indicate an event that doesn't exist since events are paths

### 503
Usually some kind of database error

## API
### eventList GET
List of all classes that are bookable  
Self attendance status; “intent”, “waiting”, or “none”  
Class time  
Count of members current attendance  
Member limit  
```javascript
[
 {
  date: Date(),
  event: [
   { eventId: EventId(), time: Time(), selfStatus: MemberStatus(), memberCount: Number(), memberLimit: Number() },
   ...
  ]
 },
 ...
]
```

### event/:eventId/:status PUT
Change attendance of a class event for this member, only succeeds if outside the freeze window

### apiKey GET
Translate a one-time code (SMS or email, or whatever) to a secret key that can be used forever

### messageList GET
Get a list of all change messages; eg. upgrade from waiting

### messageList PUT
Clears all messages
