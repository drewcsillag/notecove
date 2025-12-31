theres an interesting editor issue:
If you have the following in a note

```
# Repro Note
[ ] sometext
[ ] [[Repro Note]]
[[Repro Note]]
```

And then position the cursor before `sometext` and type two characters, the editor will display the line with the checkbox and a link as `[ ] [[Repro Note]][[Repro Note]][[Repro Note]]`. Every additional character typed will add another copy of the link. Indications are it's not persisted that way as visiting another note and coming back will show the note without the duplication. So it's more a rendering bug of some sort.
