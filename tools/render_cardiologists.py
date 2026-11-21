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

# ---------- a cardiologist ----------
def person(x, P):
    objs = []
    def add(o): objs.append(o); return o
    skin, skin_d = toon(P['name'] + 'skin', P['skin']), toon(P['name'] + 'skind', P['skin'], 0.6)
    scrub, apron, cap, hair = (toon(P['name'] + k, P[k]) for k in ('scrubs', 'apron', 'cap', 'hair'))
    white, black = toon('white', '#fbf6ea', 0.85), toon('black', '#2b2a33', 1.0)
    pink = toon('blush', '#f2a093', 1.0)
    X = lambda v: (v[0] + x, v[1], v[2])

    # torso in scrubs, cropped at the waist
    add(sphere(X((0, 0.04, 0.95)), 1, (0.76, 0.4, 0.78), scrub))
    # arms and hands
    for s in (-1, 1):
        add(cyl(X((s * 0.64, 0.02, 1.45)), X((s * 0.8, -0.02, 1.0)), 0.2, scrub, 0.18))
        add(cyl(X((s * 0.79, -0.02, 1.05)), X((s * 0.86, -0.06, 0.6)), 0.12, skin, 0.105))
        add(sphere(X((s * 0.87, -0.07, 0.52)), 0.13, (1, 0.85, 1.15), skin))
    # lead apron: a rounded panel over the front, with a V at the neck
    add(box(X((0, -0.42, 0.86)), (1.1, 0.12, 1.18), apron, 0.1))
    for s in (-1, 1):
        add(box(X((s * 0.27, -0.38, 1.47)), (0.34, 0.1, 0.3), apron, 0.06, rot=(0, s * 0.45, 0)))
    # neck, thyroid collar
    add(cyl(X((0, 0, 1.5)), X((0, 0, 1.86)), 0.17, skin_d))
    add(torus(X((0, -0.02, 1.62)), 0.24, 0.08, apron, scale=(1, 0.95, 1.4)))
    # head and ears
    add(sphere(X((0, 0, 2.28)), 0.5, (0.94, 0.9, 1.05), skin))
    for s in (-1, 1): add(sphere(X((s * 0.47, 0.02, 2.24)), 0.1, (0.6, 0.8, 1), skin_d))
    # face: eyes, brows, nose, smile, blush
    for s in (-1, 1):
        add(sphere(X((s * 0.17, -0.42, 2.3)), 0.085, (1, 0.5, 1.2), white))
        add(sphere(X((s * 0.165, -0.46, 2.29)), 0.058, (1, 0.6, 1.15), black))
        add(sphere(X((s * 0.175, -0.485, 2.315)), 0.016, (1, 1, 1), white, seg=12))
        add(tube([X((s * 0.08, -0.45, 2.46)), X((s * 0.17, -0.47, 2.5)), X((s * 0.26, -0.43, 2.47))], 0.018, hair))
        add(sphere(X((s * 0.29, -0.38, 2.12)), 0.075, (1, 0.35, 0.7), pink))
    add(sphere(X((0, -0.48, 2.19)), 0.06, (1, 0.9, 1), skin_d))
    add(tube([X((-0.13, -0.45, 2.05)), X((0, -0.49, 1.99)), X((0.13, -0.45, 2.05))], 0.02, toon('mouth', '#8f3b33', 1.0)))
    # scrub cap: a dome over the top of the head, with a tie at the back
    add(dome(X((0, 0.03, 2.28)), 0.5, (0.99, 0.97, 1.1), cap, cut=0.36))
    add(torus(X((0, 0.03, 2.47)), 0.47, 0.03, cap, scale=(1, 0.97, 1)))
    add(sphere(X((0, 0.5, 2.44)), 0.07, (1, 1, 1), cap))

    if P['female']:
        # long hair: a mass behind the head falling to the shoulders, and two locks framing the face
        add(sphere(X((0, 0.2, 2.3)), 0.55, (1.04, 0.75, 1.0), hair))
        for s in (-1, 1):
            add(sphere(X((s * 0.43, 0.0, 2.05)), 0.16, (0.85, 0.9, 2.5), hair))
            add(sphere(X((s * 0.5, 0.08, 1.62)), 0.15, (0.9, 0.9, 1.3), hair))
            for k in range(3):  # lashes
                add(tube([X((s * (0.12 + k * 0.05), -0.47, 2.37)), X((s * (0.11 + k * 0.06), -0.49, 2.41))], 0.008, black))
        # earrings
        for s in (-1, 1): add(sphere(X((s * 0.5, -0.03, 2.1)), 0.035, (1, 1, 1), toon('gold', '#e3b341', 0.8)))
        # stethoscope round the neck, chest piece on the apron
        steel = toon('steel', '#8d8a82', 0.75)
        add(tube([X((-0.22, -0.2, 1.72)), X((-0.3, -0.45, 1.45)), X((-0.22, -0.47, 1.12)), X((-0.08, -0.47, 1.02))], 0.025, steel))
        add(tube([X((0.22, -0.2, 1.72)), X((0.28, -0.45, 1.45)), X((0.18, -0.47, 1.16)), X((-0.03, -0.47, 1.04))], 0.025, steel))
        add(cyl(X((-0.05, -0.43, 1.02)), X((-0.05, -0.5, 1.02)), 0.075, toon('chest', '#c9c4b6', 0.8)))
    else:
        # short hair showing below the cap at the sides and back
        for s in (-1, 1): add(sphere(X((s * 0.44, 0.05, 2.36)), 0.12, (0.5, 0.9, 1.1), hair))
        add(sphere(X((0, 0.28, 2.3)), 0.36, (1.2, 0.6, 0.7), hair))
        # short trimmed beard along the jaw
        add(sphere(X((0, -0.04, 1.98)), 0.42, (0.98, 0.84, 0.36), toon('beard', '#4a3a32', 0.8)))
        # glasses
        for s in (-1, 1): add(torus(X((s * 0.17, -0.5, 2.3)), 0.13, 0.016, black, rot=(math.pi / 2, 0, 0)))
        add(tube([X((-0.05, -0.52, 2.33)), X((0, -0.54, 2.35)), X((0.05, -0.52, 2.33))], 0.014, black))
        # surgical mask pulled down under the chin
        add(torus(X((0, -0.03, 1.78)), 0.2, 0.055, toon('mask', '#bfe0ef', 0.8), scale=(1.1, 1.0, 1.5)))
        # a guide catheter with a Judkins curve, held up in the right hand
        add(tube([X((0.88, -0.12, 0.5)), X((0.93, -0.2, 1.1)), X((1.02, -0.22, 1.75)), X((1.18, -0.22, 1.98)),
                  X((1.33, -0.22, 1.86)), X((1.28, -0.22, 1.72))], 0.022, toon('cath', '#f5f3ee', 0.8)))
    # name badge
    add(box(X((0.3, -0.45, 1.12)), (0.22, 0.03, 0.15), white, 0.015))
    return objs

SEP = '--separate' in sys.argv
GAP = 0 if SEP else 1.12
female = person(-GAP, dict(name='f', female=True, skin='#f1c9a5', scrubs='#8cc5bd', apron='#3e5c86', cap='#e8857a', hair='#6b4330'))
male = person(GAP, dict(name='m', female=False, skin='#c98f62', scrubs='#7fa6cf', apron='#9a4b4b', cap='#5b88b8', hair='#2e2622'))

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
ls.select_silhouette = True; ls.select_border = True; ls.select_crease = True; ls.select_contour = True
sty = ls.linestyle or bpy.data.linestyles.new('ink')
ls.linestyle = sty
sty.color = INK; sty.thickness = 4.2
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
