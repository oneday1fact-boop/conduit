const {test}=require('node:test');const assert=require('node:assert/strict');const c=require('../www/pro-core.js');
const record=(extra={})=>({puzzleId:'p',slots:['FALL',null,null],elapsed:12,hintsUsed:0,completed:false,updatedAt:1,...extra});
test('archive excludes future, today, before launch, malformed and unscheduled dates',()=>{
 for(const date of ['2026-10-16','2026-10-28','2026-10-29','2026-02-30','2026-13-01','x']) assert.equal(c.available(date,'2026-10-28',800),false,date);
 assert.equal(c.available('2026-10-17','2026-10-28',800),true);
 assert.equal(c.available('2026-10-27','2026-10-28',5),false);
});
test('calendar leap years and weekday alignment are timezone independent',()=>{
 const cells=c.monthCells(2028,1);assert.equal(cells.filter(Boolean).length,29);assert.equal(cells[2],'2028-02-01');assert.equal(cells.at(-1),'2028-02-29');
});
test('merge preserves completed wins and Daily streak across old or incomplete devices',()=>{
 const done=record({completed:true,dailyWin:true,slots:['FALL','BACK','FIRE']});
 const newer=record({updatedAt:99});
 assert.equal(c.mergeRecord(done,newer).completed,true);assert.equal(c.mergeRecord(done,newer).dailyWin,true);
 assert.deepEqual(c.mergeRecord(done,newer),c.mergeRecord(newer,done));
 assert.deepEqual(c.mergeRecord(done,done),c.cleanRecord(done));
});
test('guest saves migrate without timestamps; malformed values and injected keys are ignored',()=>{
 const legacy=record();delete legacy.updatedAt;delete legacy.completed;
 const records=c.mergeRecords({'daily:2026-10-17':legacy},{'__proto__':legacy,bad:legacy,'daily:2026-10-18':record({slots:['<script>',null,null]})});
 assert.deepEqual(Object.keys(records),['daily:2026-10-17']);assert.equal(records['daily:2026-10-17'].updatedAt,0);
});
test('newest partial record wins; archive completion does not fabricate a Daily win',()=>{
 assert.equal(c.mergeRecord(record(),record({updatedAt:2,elapsed:20})).elapsed,20);
 assert.equal(c.mergeRecord(record({completed:true}),record()).dailyWin,false);
});

test('an offline progress merge does not restore an already-used rewarded hint',()=>{
 assert.equal(c.mergeRecord(record({hintsUsed:1}),record({updatedAt:99,hintsUsed:0})).hintsUsed,1);
});

test('existing schema-1 Firebase records retain modified time and previously used hints',()=>{
 const r=c.cleanRecord(record({updatedAt:{seconds:1},modifiedAt:123,hintsUsed:2}));
 assert.equal(r.updatedAt,123);assert.equal(r.hintsUsed,2);
 assert.equal(c.cleanRecord(record({completed:true,slots:[null,null,null]})).completed,false);
});
