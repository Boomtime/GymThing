## Types
`Date()` = ISO-8601 date string, YYYY-MM-DD  
`Time()` = ISO-8601 time string, HH:MM  
`MemberStatus()` = enum 'intent', 'waiting', or null  
`Number()` = standard JSON number but is not expected to ever have a decimal point  

## API
### listSchedule
#### GET
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
   { time: Time(), selfStatus: MemberStatus(), memberCurrent: Number(), memberLimit: Number() },
   ...
  ]
 },
 ...
]
```

### attend
#### PUT
Change an attendance of a class for this member  

### apiKey
#### GET
Translate a one-time code (SMS or email, or whatever) to a secret key that can be used forever

### messageList
#### GET
Get a list of all unread messages; eg. upgrade from waiting

### messageClear
#### PUT
Clears all unread events
