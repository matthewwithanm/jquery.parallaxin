Most parallax scrolling plugins are configured by giving an element a friction
value. This one's different: instead of specifying a speed, you specify the
bounds within which the element should move. This means you can easily create
a "window" whose contents move at a different speed, but whose edges are never
seen.

In other words, it's for when you don't care what speed an element scrolls at,
but rather how much of it is visible across all possible scroll positions.

Generally, you would use this plugin on an absolutely positioned element that
is bigger than its container. If the element is larger than the window, it will
scroll in the opposite direction (making sure that the entirety of the element
is visible over the scroll motion). If the element is smaller than the window,
it will scroll in the same direction as the document, but at a speed determined
by how much larger or smaller than the container it is (again, making sure the
entirety of the element is shown over the scroll motion).
