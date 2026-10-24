const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
test('opening palette preserves highlight; removal affects only selected verse',async()=>{
 const source=fs.readFileSync('app/chapter-reader.tsx','utf8');const start=source.indexOf('  const toggleVerseHighlight =');const end=source.indexOf('  const handleColorSelect',start);
 const compiled=ts.transpileModule(source.slice(start,end),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 let saved,highlighted=true,color='yellow',visible=false;
 const original={'1-1-1':'yellow','1-1-2':'blue'};
 const actions=new Function('selectedVerseForOptions','verseHighlights','saveVerseHighlights','setVerseHighlighted','setSelectedHighlightColor','setShowColorPicker',compiled+'; return {toggleVerseHighlight,removeVerseHighlight};')({bookId:1,chapterNumber:1,verseNumber:1},original,async value=>saved=value,v=>highlighted=v,v=>color=v,v=>visible=v);
 actions.toggleVerseHighlight();assert.equal(visible,true);assert.equal(highlighted,true);assert.equal(saved,undefined);
 await actions.removeVerseHighlight();assert.deepEqual(saved,{'1-1-2':'blue'});assert.equal(original['1-1-1'],'yellow');assert.equal(highlighted,false);assert.equal(color,null);assert.equal(visible,false);
});
