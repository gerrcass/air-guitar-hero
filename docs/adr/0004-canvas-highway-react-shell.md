# Canvas highway, React shell

The playfield is a Canvas 2D renderer; menus, HUD chrome, overlays, and results are React
and CSS. Drawing hundreds of perspective-transformed gems, particles, beat lines, and
crowd silhouettes into the DOM would cost layout and paint on every frame. Splitting the
shell from the runway gives a 60 fps playfield without giving up component-based menus,
focus management, and accessible markup. The trade-off is two rendering paradigms and a
deliberate boundary: React never renders a gem.
