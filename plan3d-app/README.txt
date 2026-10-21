Coll Plan3D
Coll Business Solutions LLC  ·  collbusinesssolutions@gmail.com

Turns floor plans into 3D walkthroughs you can click through like an open house.

START THE APP
  Open the "App" folder and double-click "Coll Plan3D.exe".
  (Right-click it > Send to > Desktop to make a shortcut.)
  If Windows SmartScreen warns about an unknown publisher, click
  "More info" then "Run anyway". The app isn't code-signed yet.

WHAT IT READS
  .dxf        AutoCAD drawing exchange file (best results)
  .dwg        AutoCAD drawing. Needs the free ODA File Converter installed,
              or in AutoCAD use Save As > AutoCAD DXF and import the DXF.
  .png .jpg   Photo or scan of a plan sheet. Shoot it flat and straight-on.
  .plan3d     A saved Coll Plan3D project

HOW IT WORKS
  1. Import plan. For DXF, tick the wall layers and check the size line.
     For an image, rotate it upright, then use Scale: click both ends of a
     known dimension (like the 40' overall) and type the real length.
  2. Fix and finish the plan: Wall, Door (3070), Pair (6070), Glass,
     Opening, Pass-thru (stainless, 24" x 24" default), Chase (full-height
     air chase), Room labels.
     While drawing a wall, type a length like 23'8-3/4 and press Enter.
  3. Switch to Split or 3D. Walk, Dollhouse and Plan views.

PIECES ON THE 2D PLAN (Plan tab, N or keys 1-9)
  The same snap-together pieces as the Build tab, placed on the flat plan:
  click "Pieces" in the left toolbar, pick a piece in the bar across the
  top, and click. Same snapping rules as Build. R turns a free piece.
  Widths can be typed as 19-1/2, 19 1/2 or 19.5 (inches).

PLAN SHEET (PDF) (Plan sheet button, Ctrl+P)
  A printable drawing like a shop plan: walls to scale, panel widths
  chained along every wall, overall dimensions outside, doors tagged
  3070/6070, glass G, pass-thrus PT, S.P. panels highlighted, room names,
  and a Coll Business Solutions LLC title block. Pick the paper size
  (Letter, Tabloid 11x17, ARCH C, ARCH D). "Best fit" turns the plan
  sideways when that allows a larger scale. Export PDF saves it.

BUILD IN 3D (Build tab, F4)
  Snap a room together from pieces instead of drawing it:
    1 Panel (24, 36, 48" or any custom width)   2 S.P. panel   3 Glass panel
    4 Door 3070   5 Pair 6070   6 Pass-thru   7 Air chase   8 LED   9 FFU
  Click to place. Pieces snap to open ends, turn the corner toward your
  mouse, and start a T-joint off the middle of a wall. Click a doors/glass/
  pass-thru piece onto an existing panel to swap it in. R rotates a free
  piece, V selects, Delete removes, F frames the view.
  Studs and posts are worked out from how the panels meet: H-studs at
  straight joints, corner posts, T-posts and end caps.
  The parts list (right panel) counts everything as you build. Export it
  with "Export parts list (.csv)" or File > Export Parts List.
  4. Export walkthrough (.html) to share. It opens in any browser,
     phones too. Export .glb for SketchUp, Blender or Windows 3D Viewer.

REBUILDING FROM SOURCE (optional)
  The "source" folder has the full project. With Node.js installed:
    cd source
    npm install
    npm start                 run it
    npm run package-win       rebuild the Windows app into source\dist
