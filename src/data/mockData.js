export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const DATES = ['5', '6', '7', '8', '9'];

export const busyMatrix = {
  0: { 0:['a','b'], 1:['a','b'], 2:[], 3:[], 4:['c'], 5:['c'], 6:[], 7:[], 8:['a','b','c','d'], 9:['a','b','c','d'], 10:[], 11:[], 12:['b','d'], 13:['b','d'], 14:[], 15:[], 16:['a'], 17:['a'] },
  1: { 0:[], 1:[], 2:['a'], 3:['a'], 4:[], 5:[], 6:['b','c'], 7:['b','c'], 8:[], 9:[], 10:['d'], 11:['d'], 12:[], 13:[], 14:['a','c'], 15:['a','c'], 16:[], 17:[] },
  2: { 0:['c','d'], 1:['c','d'], 2:[], 3:[], 4:['a'], 5:['a'], 6:[], 7:[], 8:['b'], 9:['b'], 10:[], 11:[], 12:['a','b','c','d'], 13:['a','b','c','d'], 14:[], 15:[], 16:['c'], 17:['c'] },
  3: { 0:[], 1:[], 2:['b'], 3:['b'], 4:[], 5:[], 6:['a','d'], 7:['a','d'], 8:[], 9:[], 10:['c'], 11:['c'], 12:[], 13:[], 14:['b'], 15:['b'], 16:[], 17:[] },
  4: { 0:['a','b','c'], 1:['a','b','c'], 2:[], 3:[], 4:['d'], 5:['d'], 6:[], 7:[], 8:['a'], 9:['a'], 10:[], 11:[], 12:['b','c','d'], 13:['b','c','d'], 14:[], 15:[], 16:[], 17:[] },
};

export const GCAL_EVENTS = [
  { day:0, startH:9,  startM:0,  endH:9,  endM:30,  title:'Standup' },
  { day:0, startH:13, startM:0,  endH:14, endM:0,   title:'Lunch w/ Sarah' },
  { day:1, startH:10, startM:30, endH:11, endM:30,  title:'Sprint Planning' },
  { day:1, startH:15, startM:0,  endH:16, endM:0,   title:'Design Critique' },
  { day:2, startH:9,  startM:0,  endH:10, endM:0,   title:'Weekly Sync' },
  { day:2, startH:14, startM:0,  endH:15, endM:30,  title:'Client Call' },
  { day:2, startH:16, startM:30, endH:17, endM:0,   title:'1:1 w/ PM' },
  { day:3, startH:8,  startM:30, endH:9,  endM:0,   title:'Standup' },
  { day:3, startH:11, startM:0,  endH:12, endM:0,   title:'Product Review' },
  { day:3, startH:14, startM:30, endH:16, endM:0,   title:'Eng All-Hands' },
  { day:4, startH:10, startM:0,  endH:10, endM:30,  title:'Standup' },
  { day:4, startH:13, startM:30, endH:14, endM:30,  title:'Demo Prep' },
];

export const BOOKED_EVENTS = [
  { day:0, startHour:9,  startMin:0,  durationMins:30,  title:'Design Sync',          people:['A','S'],        color:'#00BFA5', status:'booked' },
  { day:1, startHour:11, startMin:0,  durationMins:60,  title:'Q2 Planning Kickoff',  people:['A','S','J','R'], color:'#00897B', status:'booked' },
  { day:2, startHour:14, startMin:0,  durationMins:60,  title:'Product Review',       people:['A','J'],        color:'#26A69A', status:'booked' },
  { day:3, startHour:10, startMin:0,  durationMins:60,  title:'Q2 Planning Kickoff',  people:['A','S','J','R'], color:'#00897B', status:'booked' },
  { day:3, startHour:15, startMin:30, durationMins:30,  title:'1:1 w/ Manager',       people:['A','M'],        color:'#4DB6AC', status:'booked' },
  { day:4, startHour:9,  startMin:30, durationMins:90,  title:'Eng All-Hands',        people:['A','S','J'],    color:'#80CBC4', status:'pending' },
];

export const CAL_START_HOUR = 8;
export const CAL_END_HOUR = 19;
export const CAL_HOURS = Array.from({ length: CAL_END_HOUR - CAL_START_HOUR }, (_, i) => CAL_START_HOUR + i);
export const SLOT_H = 52;
