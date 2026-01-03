# Original Prompt

in notes, I want collapsible headings. What that means is there should be a little arrow/triangle next to heading items, and if clicked it will hide the text (and turn the arrow/triangle) from the heading (but not including the heading) to the next heading of the same or higher heading level. For example if you have something like this:

```
# foo
sdfs
## bar
sosdfs
## Fred
sdfsd
### barney
ppppp
# spam
```

if you collapse bar, it would hide `sosdfs`
if you collapse fred, it would hide `sdfsd` and the `barney` heading with its `ppppp`
if you collapse foo, it would hide everything up to the `spam` heading.
