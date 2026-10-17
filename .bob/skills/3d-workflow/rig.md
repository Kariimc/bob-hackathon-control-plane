# Canonical 3-Point Lighting Rig

The single fixed lighting setup used for all asset validation in the
3d-workflow skill. Every quality review, score comparison, and iteration
must use this rig. Consistent lighting is what makes iteration meaningful —
if the rig changes between passes, you cannot know if the improvement came
from the asset or the lighting.

---

## Rig specification

```
KEY LIGHT
  Position:   45° horizontal right, 45° vertical elevation
  Distance:   Asset diagonal × 3.0 from origin
  Type:       Area light (soft shadows, not point)
  Intensity:  1.0 (normalized)
  Color temp: 5500K (neutral daylight — D55)
  Shadow:     On, softness 0.1

FILL LIGHT
  Position:   -45° horizontal left, 20° vertical elevation
  Distance:   Asset diagonal × 3.5 from origin
  Type:       Area light
  Intensity:  0.35 (35% of key)
  Color temp: 6500K (slightly cool — sky light simulation)
  Shadow:     Off (fill lights don't cast shadows)

RIM LIGHT (back light / hair light)
  Position:   180° behind, 45° vertical elevation
  Distance:   Asset diagonal × 2.0 from origin
  Type:       Area light
  Intensity:  0.6 (60% of key)
  Color temp: 4500K (slightly warm — indirect bounce simulation)
  Shadow:     On, softness 0.05 (harder than key)

ENVIRONMENT
  Type:       HDRI — neutral grey sphere, no strong directionality
  Exposure:   0.2 (ambient fill only, does not compete with rigs)
  Rotation:   0° (front of HDRI faces camera)

CAMERA
  Type:       Perspective
  FOV:        39.6° vertical (50mm equivalent on full-frame)
  Position:   Asset center X, Asset center Y, Asset diagonal × 2.5
  Target:     Asset bounding box center
  Near clip:  0.1
  Far clip:   Asset diagonal × 20
```

---

## Blender/bpy implementation

```python
import bpy
import mathutils
import math

def setup_lighting_rig(asset_obj: bpy.types.Object) -> bpy.types.Collection:
    """
    Creates the canonical 3-point lighting rig for asset validation.
    Clears any existing lights before creating the rig.
    Returns a collection containing all rig objects.
    """
    # Remove existing lights
    for obj in list(bpy.data.objects):
        if obj.type == 'LIGHT':
            bpy.data.objects.remove(obj, do_unlink=True)

    # Compute asset dimensions
    bbox = [asset_obj.matrix_world @ mathutils.Vector(corner)
            for corner in asset_obj.bound_box]
    center = sum(bbox, mathutils.Vector()) / 8
    diagonal = max(
        (max(b.x for b in bbox) - min(b.x for b in bbox)),
        (max(b.y for b in bbox) - min(b.y for b in bbox)),
        (max(b.z for b in bbox) - min(b.z for b in bbox)),
    )
    if diagonal < 0.001:
        diagonal = 1.0

    def make_area_light(name, energy, color_temp_k, pos_offset, shadow=True):
        bpy.ops.object.light_add(type='AREA', location=center + pos_offset)
        light_obj = bpy.context.active_object
        light_obj.name = name
        light = light_obj.data
        light.energy = energy * (diagonal ** 2) * 10  # scale with asset size
        # Approximate color temperature as RGB
        # 6500K ≈ (0.95, 0.95, 1.0), 5500K ≈ (1.0, 0.96, 0.87), 4500K ≈ (1.0, 0.87, 0.70)
        temp_colors = {6500: (0.95, 0.95, 1.0), 5500: (1.0, 0.96, 0.87), 4500: (1.0, 0.87, 0.70)}
        light.color = temp_colors.get(color_temp_k, (1.0, 1.0, 1.0))
        light.use_shadow = shadow
        light.size = diagonal * 0.8
        # Point light at asset center
        direction = center - light_obj.location
        rot = direction.to_track_quat('-Z', 'Y')
        light_obj.rotation_euler = rot.to_euler()
        return light_obj

    d = diagonal
    key  = make_area_light('RIG_Key',  1.00, 5500,
                           mathutils.Vector(( d*2.1,  -d*2.1,  d*2.1)), shadow=True)
    fill = make_area_light('RIG_Fill', 0.35, 6500,
                           mathutils.Vector((-d*2.5,  -d*2.5,  d*1.2)), shadow=False)
    rim  = make_area_light('RIG_Rim',  0.60, 4500,
                           mathutils.Vector(( d*0.1,   d*3.0,  d*2.1)), shadow=True)

    # HDRI world
    world = bpy.context.scene.world
    if not world:
        world = bpy.data.worlds.new("RIG_World")
        bpy.context.scene.world = world
    world.use_nodes = True
    bg_node = world.node_tree.nodes.get("Background")
    if bg_node:
        bg_node.inputs["Color"].default_value = (0.5, 0.5, 0.5, 1.0)
        bg_node.inputs["Strength"].default_value = 0.2

    # Camera
    bpy.ops.object.camera_add(location=center + mathutils.Vector((0, -d*2.5, d*0.5)))
    cam_obj = bpy.context.active_object
    cam_obj.name = "RIG_Camera"
    cam_obj.data.lens = 50  # 50mm
    direction = center - cam_obj.location
    rot = direction.to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot.to_euler()
    bpy.context.scene.camera = cam_obj

    # Collect into a group
    rig_col = bpy.data.collections.new("3PointRig")
    bpy.context.scene.collection.children.link(rig_col)
    for obj in [key, fill, rim, cam_obj]:
        rig_col.objects.link(obj)
        bpy.context.scene.collection.objects.unlink(obj)

    return rig_col
```

---

## Three.js implementation

```javascript
import * as THREE from 'three';

/**
 * Creates the canonical 3-point lighting rig scaled to the given asset.
 * @param {THREE.Object3D} asset - The asset being lit
 * @returns {THREE.Group} - Rig group, add to scene
 */
export function createLightingRig(asset) {
  const rig = new THREE.Group();
  rig.name = 'LightingRig_3Point';

  // Compute asset bounding box
  const box = new THREE.Box3().setFromObject(asset);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);
  const diagonal = Math.max(size.x, size.y, size.z);
  const d = diagonal < 0.001 ? 1.0 : diagonal;

  // Helper: color temperature to THREE.Color approximation
  const colorTemp = (k) => {
    if (k >= 6500) return new THREE.Color(0.95, 0.95, 1.00); // cool
    if (k >= 5500) return new THREE.Color(1.00, 0.96, 0.87); // neutral
    return           new THREE.Color(1.00, 0.87, 0.70);       // warm
  };

  // Key light — right front, 45°/45°
  const key = new THREE.RectAreaLight(colorTemp(5500), 1.0 * d * 10, d * 2, d * 2);
  key.name = 'Key';
  key.position.set(center.x + d * 2.1, center.y + d * 2.1, center.z + d * 2.1);
  key.lookAt(center);

  // Fill light — left front, lower
  const fill = new THREE.RectAreaLight(colorTemp(6500), 0.35 * d * 10, d * 2, d * 2);
  fill.name = 'Fill';
  fill.position.set(center.x - d * 2.5, center.y + d * 1.2, center.z - d * 2.5);
  fill.lookAt(center);

  // Rim light — behind, elevated
  const rim = new THREE.RectAreaLight(colorTemp(4500), 0.6 * d * 10, d * 1.5, d * 1.5);
  rim.name = 'Rim';
  rim.position.set(center.x + d * 0.1, center.y + d * 2.1, center.z + d * 3.0);
  rim.lookAt(center);

  // Ambient (HDRI approximation)
  const ambient = new THREE.AmbientLight(0x808080, 0.2);
  ambient.name = 'Ambient';

  rig.add(key, fill, rim, ambient);

  return rig;
}

/**
 * Creates the canonical validation camera.
 * @param {THREE.Object3D} asset
 * @returns {{ camera: THREE.PerspectiveCamera, controls: null }}
 */
export function createValidationCamera(asset) {
  const box = new THREE.Box3().setFromObject(asset);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);
  const diagonal = Math.max(size.x, size.y, size.z);
  const d = diagonal < 0.001 ? 1.0 : diagonal;

  const camera = new THREE.PerspectiveCamera(
    39.6,                      // 50mm equivalent vertical FOV
    window.innerWidth / window.innerHeight,
    d * 0.1,                   // near
    d * 20,                    // far
  );
  camera.position.set(center.x, center.y + d * 0.5, center.z + d * 2.5);
  camera.lookAt(center);

  return { camera };
}
```

---

## 8-angle validation views

For every quality gate, render (or screenshot) the asset from all 8 canonical angles:

| View | Camera position (relative to asset center) |
|---|---|
| Front | Z+ axis, eye level |
| Back | Z- axis, eye level |
| Left | X- axis, eye level |
| Right | X+ axis, eye level |
| Top | Y+ axis, looking down |
| Bottom | Y- axis, looking up |
| Front-right 45° | Between front and right, 30° elevation |
| Back-left 45° | Between back and left, 30° elevation |

The silhouette must read clearly from all 8 views. If any view is ambiguous,
the geometry has a problem that must be resolved before the UV phase.
