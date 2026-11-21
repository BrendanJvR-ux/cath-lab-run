# Cath Lab Run: two original cartoon cardiologists, cel-shaded with hand-drawn (Freestyle) ink outlines.
# Renders the menu picture assets/cardiologists.png (both together, transparent background).
# Run from the repo root:  /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/render_cardiologists.py -- assets
# Add --separate to also render each one alone on paper (cardiologist_female.png, cardiologist_male.png).
import bpy, bmesh, sys, math, os
from mathutils import Vector

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp'
PAPER = (0.953, 0.918, 0.831)
INK = (0.03, 0.03, 0.045)

def hexc(h):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    # sRGB -> linear for the shader
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1.0,)

# ---------- clean scene ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------- toon material: lit/shadow bands of the base colour, emitted flat ----------
_mats = {}
def toon(name, hexcol, shadow=0.72):
    if name in _mats: return _mats[name]
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    nt = m.node_tree; N = nt.nodes; L = nt.links
    for n in list(N): N.remove(n)
    out = N.new('ShaderNodeOutputMaterial')
    dif = N.new('ShaderNodeBsdfDiffuse')
    s2r = N.new('ShaderNodeShaderToRGB')
    ramp = N.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'CONSTANT'
    e = ramp.color_ramp.elements
    e[0].position = 0.0; e[0].color = (shadow, shadow, shadow, 1)
    e[1].position = 0.32; e[1].color = (1, 1, 1, 1)
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    mix.inputs[6].default_value = hexc(hexcol)
    em = N.new('ShaderNodeEmission')
    L.new(dif.outputs[0], s2r.inputs[0]); L.new(s2r.outputs[0], ramp.inputs[0])
    L.new(ramp.outputs[0], mix.inputs[7]); L.new(mix.outputs[2], em.inputs[0]); L.new(em.outputs[0], out.inputs[0])
    _mats[name] = m
    return m

def finish(obj, mat, smooth=True, subdiv=1):
    obj.data.materials.append(mat)
    if smooth:
        for p in obj.data.polygons: p.use_smooth = True
    if subdiv:
        mod = obj.modifiers.new('sub', 'SUBSURF'); mod.levels = subdiv; mod.render_levels = subdiv
    return obj

def sphere(loc, r, scale=(1, 1, 1), mat=None, rot=(0, 0, 0), seg=32):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=seg, ring_count=seg // 2, rotation=rot)
    o = bpy.context.active_object; o.scale = scale
    return finish(o, mat, subdiv=1)

def dome(loc, r, scale, mat, cut=0.0):
    # a sphere with everything below a plane removed (cut is in units of the radius, -1..1)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(0, 0, 0), segments=48, ring_count=24)
    o = bpy.context.active_object
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, cut * r), plane_no=(0, 0, 1), clear_inner=True)
    bm.to_mesh(o.data); bm.free()
    o.location = loc; o.scale = scale
    sol = o.modifiers.new('thick', 'SOLIDIFY'); sol.thickness = 0.03
    return finish(o, mat, subdiv=1)

def cyl(a, b, r, mat, r2=None):
    a, b = Vector(a), Vector(b); d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=r, radius2=(r2 if r2 is not None else r), depth=d.length, location=(a + b) / 2)
    o = bpy.context.active_object
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return finish(o, mat, subdiv=0)

def torus(loc, R, r, mat, rot=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(location=loc, major_radius=R, minor_radius=r, rotation=rot, major_segments=48, minor_segments=16)
    o = bpy.context.active_object; o.scale = scale
    return finish(o, mat, subdiv=0)

def box(loc, size, mat, bevel=0.08, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.active_object; o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    m = o.modifiers.new('bev', 'BEVEL'); m.width = bevel; m.segments = 4
    return finish(o, mat, subdiv=1)

def tube(points, r, mat):
    cu = bpy.data.curves.new('c', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 6
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(points) - 1)
    for bp, p in zip(sp.bezier_points, points):
        bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    o = bpy.data.objects.new('tube', cu); bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH')
    return bpy.context.active_object

# ---------- smooth organic shapes: metaballs, converted to meshes ----------
def mball(name, elems, mat, res=0.035):
    """elems: ('ball', co, r) | ('ell', co, _, (a, b, c)) | ('cap', p, q, r), all in visible sizes (radius / half extents).
    Elements of one call blend into one smooth body. At threshold 0.6 and stiffness 2 a metaball's visible surface
    sits at 0.575 × its radius, hence K."""
    K = 1 / 0.575
    mb = bpy.data.metaballs.new(name); mb.resolution = res; mb.render_resolution = res; mb.threshold = 0.6
    for e in elems:
        if e[0] == 'ball':
            el = mb.elements.new(type='BALL'); el.co = e[1]; el.radius = e[2] * K
        elif e[0] == 'ell':
            el = mb.elements.new(type='ELLIPSOID'); el.co = e[1]; el.radius = K; el.size_x, el.size_y, el.size_z = e[3]
        else:
            A, B = Vector(e[1]), Vector(e[2]); d = B - A
            el = mb.elements.new(type='CAPSULE'); el.co = (A + B) / 2; el.radius = e[3] * K; el.size_x = d.length / 2
            el.rotation = Vector((1, 0, 0)).rotation_difference(d.normalized())
        el.stiffness = 2.0
    o = bpy.data.objects.new(name, mb); bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.active_object
    o.data.materials.append(mat)
    for poly in o.data.polygons: poly.use_smooth = True
    return o

def shell(bounds, mat, keep):
    """A curved panel cut from an ellipsoid that wraps the body: bounds = (centre, half extents);
    keep = list of (plane point, plane normal) half-spaces to keep."""
    c, h = bounds
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(0, 0, 0), segments=64, ring_count=32)
    o = bpy.context.active_object
    bm = bmesh.new(); bm.from_mesh(o.data)
    for co, no in keep:
        lco = [(co[i] - c[i]) / h[i] for i in range(3)]; lno = Vector([no[i] * h[i] for i in range(3)]).normalized()
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=lco, plane_no=lno, clear_inner=True)
    bm.to_mesh(o.data); bm.free()
    o.location = c; o.scale = h
    sol = o.modifiers.new('thick', 'SOLIDIFY'); sol.thickness = 0.035; sol.offset = 1
    return finish(o, mat, subdiv=1)

def bounds(o):
    pts = [o.matrix_world @ Vector(v) for v in o.bound_box]
    lo = [min(p[i] for p in pts) for i in range(3)]; hi = [max(p[i] for p in pts) for i in range(3)]
    return [(lo[i] + hi[i]) / 2 for i in range(3)], [(hi[i] - lo[i]) / 2 for i in range(3)]

# ---------- a cardiologist ----------
def person(x, P):
    objs = []
    def add(o): objs.append(o); return o
    tag = P['name']
    skin, skin_d = toon(tag + 'skin', P['skin']), toon(tag + 'skind', P['skin'], 0.6)
    scrub, apron, cap, hair = (toon(tag + k, P[k]) for k in ('scrubs', 'apron', 'cap', 'hair'))
    white, black = toon('white', '#fbf6ea', 0.85), toon('black', '#2b2a33', 1.0)
    pink = toon('blush', '#f2a093', 1.0)
    X = lambda v: (v[0] + x, v[1], v[2])
    A = P['arms']  # per side: (elbow, wrist, hand) points for the left (-x) and right (+x) arm

    # body in scrubs: chest, rounded shoulders, waist, and short sleeves down to just above the elbow
    sh = {-1: X((-0.6, 0.02, 1.4)), 1: X((0.6, 0.02, 1.4))}
    def along(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))
    elems = [('ell', X((0, 0.03, 1.04)), 1.0, (0.56, 0.35, 0.54)),
             ('ell', X((0, 0.03, 1.36)), 1.0, (0.6, 0.31, 0.2)),
             ('ell', X((0, 0.04, 0.6)), 1.0, (0.48, 0.31, 0.36))]
    for s in (-1, 1):
        el = X(A[s][0]); elems.append(('cap', sh[s], along(sh[s], el, 0.55), 0.165))
    body = add(mball(tag + '_body', elems, scrub))
    # bare arms from the sleeve to the hand, with a rounded elbow and a mitten hand with a thumb
    for s in (-1, 1):
        el, wr, hd = X(A[s][0]), X(A[s][1]), X(A[s][2])
        thumb = X(A[s][3]) if len(A[s]) > 3 else None
        e = [('cap', along(sh[s], el, 0.5), el, 0.098), ('ball', el, 0.1), ('cap', el, wr, 0.088), ('ell', hd, 0, (0.12, 0.09, 0.15))]
        if thumb: e.append(('cap', hd, thumb, 0.045))
        add(mball(tag + '_arm' + str(s), e, skin, 0.03))
    # lead apron: a curved front panel that follows the chest, with straps over the shoulders and a V neck
    ac, ah = X((0, -0.02, 0.92)), (0.58, 0.43, 0.66)
    add(shell((ac, ah), apron, [((0, ac[1] - ah[1] * 0.3, 0), (0, -1, 0)), ((0, 0, 1.4), (0, 0, -1)), ((0, 0, 0.3), (0, 0, 1)),
                                 ((x - 0.42, 0, 0), (1, 0, 0)), ((x + 0.42, 0, 0), (-1, 0, 0))]))
    for s in (-1, 1):  # shoulder straps
        add(tube([X((s * 0.3, -0.3, 1.28)), X((s * 0.33, -0.27, 1.5)), X((s * 0.37, 0.0, 1.57)), X((s * 0.36, 0.22, 1.45))], 0.045, apron))
    # neck, thyroid collar
    add(cyl(X((0, 0, 1.45)), X((0, 0, 1.86)), 0.17, skin_d))
    add(torus(X((0, -0.02, 1.64)), 0.23, 0.08, apron, scale=(1, 0.95, 1.35)))
    # head (slightly tilted for her), ears
    hx = P.get('tilt', 0)
    add(sphere(X((hx, 0, 2.28)), 0.5, (0.94, 0.9, 1.05), skin, rot=(0, hx * 0.6, 0)))
    for s in (-1, 1): add(sphere(X((hx + s * 0.47, 0.02, 2.24 - s * hx * 0.3)), 0.1, (0.6, 0.8, 1), skin_d))
    F = lambda v: X((v[0] + hx, v[1], v[2] - v[0] * hx * 0.6))   # face features follow the tilt
    for s in (-1, 1):
        add(sphere(F((s * 0.17, -0.42, 2.3)), 0.085, (1, 0.5, 1.2), white))
        add(sphere(F((s * 0.165, -0.46, 2.29)), 0.058, (1, 0.6, 1.15), black))
        add(sphere(F((s * 0.175, -0.485, 2.315)), 0.016, (1, 1, 1), white, seg=12))
        add(tube([F((s * 0.08, -0.45, 2.46)), F((s * 0.17, -0.47, 2.5)), F((s * 0.26, -0.43, 2.47))], 0.018, hair))
        add(sphere(F((s * 0.29, -0.38, 2.12)), 0.075, (1, 0.35, 0.7), pink))
    add(sphere(F((0, -0.48, 2.19)), 0.06, (1, 0.9, 1), skin_d))
    add(tube([F((-0.14, -0.45, 2.06)), F((0, -0.5, 1.98)), F((0.14, -0.45, 2.06))], 0.02, toon('mouth', '#8f3b33', 1.0)))
    add(dome(F((0, 0.03, 2.28)), 0.5, (0.99, 0.97, 1.1), cap, cut=0.36))
    add(torus(F((0, 0.03, 2.47)), 0.47, 0.03, cap, scale=(1, 0.97, 1)))
    add(sphere(F((0, 0.5, 2.44)), 0.07, (1, 1, 1), cap))
    # name badge on the apron
    add(box(X((0.24, -0.47, 1.15)), (0.2, 0.03, 0.14), white, 0.015, rot=(0, 0, 0.1)))

    if P['female']:
        add(sphere(F((0, 0.2, 2.3)), 0.55, (1.04, 0.75, 1.0), hair))
        for s in (-1, 1):
            add(sphere(F((s * 0.43, 0.0, 2.05)), 0.16, (0.85, 0.9, 2.5), hair))
            add(sphere(F((s * 0.5, 0.08, 1.62)), 0.15, (0.9, 0.9, 1.3), hair))
            for k in range(3):
                add(tube([F((s * (0.12 + k * 0.05), -0.47, 2.37)), F((s * (0.11 + k * 0.06), -0.49, 2.41))], 0.008, black))
            add(sphere(F((s * 0.5, -0.03, 2.1)), 0.035, (1, 1, 1), toon('gold', '#e3b341', 0.8)))
        steel = toon('steel', '#8d8a82', 0.75)
        add(tube([X((-0.2, -0.22, 1.74)), X((-0.28, -0.48, 1.45)), X((-0.2, -0.5, 1.16)), X((-0.06, -0.5, 1.06))], 0.025, steel))
        add(tube([X((0.2, -0.22, 1.74)), X((0.26, -0.48, 1.45)), X((0.16, -0.5, 1.18)), X((-0.02, -0.5, 1.08))], 0.025, steel))
        add(cyl(X((-0.04, -0.46, 1.06)), X((-0.04, -0.53, 1.06)), 0.075, toon('chest', '#c9c4b6', 0.8)))
        # clipboard held against her side, with a sketched angiogram on it
        cb = X((0.56, -0.62, 1.0))
        add(box(cb, (0.5, 0.04, 0.66), toon('board', '#b5835a', 0.8), 0.02, rot=(0.1, -0.35, 0.12)))
        add(box((cb[0] - 0.012, cb[1] - 0.03, cb[2] - 0.03), (0.42, 0.02, 0.55), white, 0.01, rot=(0.1, -0.35, 0.12)))
        add(box((cb[0] + 0.03, cb[1] - 0.03, cb[2] + 0.32), (0.18, 0.05, 0.06), toon('clip', '#8d8a82', 0.75), 0.01, rot=(0.1, -0.35, 0.12)))
        red = toon('ink_red', '#c2452d', 1.0)
        add(tube([(cb[0] - 0.12, cb[1] - 0.09, cb[2] + 0.18), (cb[0] - 0.02, cb[1] - 0.09, cb[2] + 0.12), (cb[0] + 0.02, cb[1] - 0.1, cb[2] - 0.05), (cb[0] + 0.1, cb[1] - 0.12, cb[2] - 0.2)], 0.012, red))
        add(tube([(cb[0] - 0.02, cb[1] - 0.09, cb[2] + 0.12), (cb[0] + 0.12, cb[1] - 0.11, cb[2] + 0.06), (cb[0] + 0.16, cb[1] - 0.12, cb[2] - 0.08)], 0.01, red))
    else:
        for s in (-1, 1): add(sphere(X((s * 0.44, 0.05, 2.36)), 0.12, (0.5, 0.9, 1.1), hair))
        add(sphere(X((0, 0.28, 2.3)), 0.36, (1.2, 0.6, 0.7), hair))
        add(sphere(X((0, -0.04, 1.98)), 0.42, (0.98, 0.84, 0.36), toon('beard', '#4a3a32', 0.8)))
        for s in (-1, 1): add(torus(X((s * 0.17, -0.5, 2.3)), 0.13, 0.016, black, rot=(math.pi / 2, 0, 0)))
        add(tube([X((-0.05, -0.52, 2.33)), X((0, -0.54, 2.35)), X((0.05, -0.52, 2.33))], 0.014, black))
        add(torus(X((0, -0.03, 1.78)), 0.2, 0.055, toon('mask', '#bfe0ef', 0.8), scale=(1.1, 1.0, 1.5)))
        # guide catheter held up in his raised hand: the Judkins curve above, the shaft trailing down
        hd = X(A[1][2])
        add(tube([(hd[0] - 0.12, hd[1] - 0.05, hd[2] - 0.75), (hd[0] - 0.06, hd[1] - 0.05, hd[2] - 0.3), (hd[0], hd[1] - 0.08, hd[2]),
                  (hd[0] + 0.03, hd[1] - 0.08, hd[2] + 0.45), (hd[0] + 0.12, hd[1] - 0.08, hd[2] + 0.78), (hd[0] + 0.27, hd[1] - 0.08, hd[2] + 0.86),
                  (hd[0] + 0.35, hd[1] - 0.08, hd[2] + 0.72), (hd[0] + 0.28, hd[1] - 0.08, hd[2] + 0.62)], 0.024, toon('cath', '#f5f3ee', 0.8)))
    return objs

SEP = '--separate' in sys.argv
GAP = 0 if SEP else 1.12
female = person(-GAP, dict(name='f', female=True, tilt=0.06,
    # waving with her right hand (viewer's left); left forearm across to hold the clipboard
    arms={-1: ((-0.98, -0.02, 1.12), (-1.1, -0.1, 1.62), (-1.12, -0.12, 1.8)), 1: ((0.86, 0.0, 0.9), (0.66, -0.4, 1.0), (0.56, -0.5, 1.03))}, skin='#f1c9a5', scrubs='#8cc5bd', apron='#3e5c86', cap='#e8857a', hair='#6b4330'))
male = person(GAP, dict(name='m', female=False,
    # hand on hip (viewer's left), catheter held up in the other hand
    arms={-1: ((-1.02, 0.06, 1.0), (-0.74, -0.06, 0.66), (-0.66, -0.1, 0.62)), 1: ((0.98, 0.0, 1.02), (0.92, -0.26, 1.45), (0.9, -0.32, 1.56), (0.8, -0.38, 1.6))}, skin='#c98f62', scrubs='#7fa6cf', apron='#9a4b4b', cap='#5b88b8', hair='#2e2622'))

# ---------- camera, light, world ----------
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
scene.collection.objects.link(cam); scene.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 3.3 if SEP else 5.1
cam.location = (0 if SEP else 0.14, -10, 1.58 if SEP else 1.5); cam.rotation_euler = (math.radians(90), 0, 0)
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
scene.collection.objects.link(sun); sun.rotation_euler = (math.radians(55), math.radians(-25), math.radians(-30)); sun.data.energy = 3

world = bpy.data.worlds.new('w'); scene.world = world
try: world.use_nodes = True
except Exception: pass
bg = world.node_tree.nodes.get('Background') or world.node_tree.nodes.new('ShaderNodeBackground')
bg.inputs[0].default_value = PAPER + (1,); bg.inputs[1].default_value = 1.0

# ---------- render settings: EEVEE + Freestyle wobbly ink lines ----------
for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try: scene.render.engine = eng; break
    except Exception: pass
try: scene.eevee.taa_render_samples = 16
except Exception: pass
scene.view_settings.view_transform = 'Standard'
scene.render.resolution_x, scene.render.resolution_y = (900, 1100) if SEP else (1100, 760)
scene.render.film_transparent = not SEP
scene.render.image_settings.color_mode = 'RGBA'
scene.render.use_freestyle = True
scene.render.line_thickness_mode = 'ABSOLUTE'; scene.render.line_thickness = 1.0
vl = scene.view_layers[0]; vl.use_freestyle = True
fs = vl.freestyle_settings
ls = fs.linesets[0] if len(fs.linesets) else fs.linesets.new('ink')
ls.select_silhouette = True; ls.select_border = True; ls.select_crease = False; ls.select_contour = True
sty = ls.linestyle or bpy.data.linestyles.new('ink')
ls.linestyle = sty
sty.color = INK; sty.thickness = 4.2
try: sty.use_length_min = True; sty.length_min = 14
except Exception: pass
try:
    n = sty.geometry_modifiers.new('wobble', 'PERLIN_NOISE_1D'); n.frequency = 9; n.amplitude = 2.2; n.octaves = 2
    t = sty.thickness_modifiers.new('pressure', 'NOISE'); t.amplitude = 2.0; t.period = 30
except Exception as e:
    print('linestyle modifiers:', e)

def render(show, hide, path):
    for o in hide: o.hide_render = True
    for o in show: o.hide_render = False
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

if SEP:
    render(female, male, os.path.join(OUT, 'cardiologist_female.png'))
    render(male, female, os.path.join(OUT, 'cardiologist_male.png'))
else:
    render(female + male, [], os.path.join(OUT, 'cardiologists.png'))
print('DONE')
