// A plate with a circular hole, made from two primitive solids.

$fn = 64;

difference() {
    cube([40, 30, 8], center = true);
    cylinder(h = 12, d = 14, center = true);
}
