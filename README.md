Most parallax scrolling plugins are configured by giving an element a friction
value. This one's different: instead of specifying a speed, you specify the
bounds within which the element should move. This means you can easily create
a "window" whose contents move at a different speed, but whose edges are never
seen.

Generally, you would use this plugin on an absolutely positioned element that
was bigger than its container.
