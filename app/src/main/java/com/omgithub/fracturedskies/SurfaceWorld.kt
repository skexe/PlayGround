package com.omgithub.fracturedskies

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

enum class NodeShape { CRYSTAL, PLANT, ORE, POD }

data class ResourceNode(
    val id: Int,
    val resource: ResourceType,
    val x: Float,
    val z: Float,
    val size: Float,
    val shape: NodeShape,
    var amount: Int,
    var scanned: Boolean = false
) {
    var depleted: Boolean = false
    val maxAmount: Int = amount
}

data class Flora(
    val x: Float,
    val z: Float,
    val height: Float,
    val width: Float,
    val type: Int,
    val tint: Int,
    val sway: Float
)

data class Rock(
    val x: Float,
    val z: Float,
    val size: Float,
    val tint: Int
)

data class Fauna(
    val name: String,
    var x: Float,
    var z: Float,
    val size: Float,
    val tint: Int,
    val phase: Float,
    var scanned: Boolean = false,
    var angle: Float = 0f
)

data class Sentinel(
    val id: Int,
    var x: Float,
    var z: Float,
    var health: Float = 100f,
    var alive: Boolean = true,
    var phase: Float = 0f,
    var cooldown: Float = 1.2f
)

class SurfaceWorld(val planet: Planet) {
    val nodes = ArrayList<ResourceNode>()
    val flora = ArrayList<Flora>()
    val rocks = ArrayList<Rock>()
    val fauna = ArrayList<Fauna>()
    val sentinels = ArrayList<Sentinel>()
    val spawnHeight: Float
    val shipX = 12f
    val shipZ = -13f
    val monolithX = -31f
    val monolithZ = -38f
    var time = 0f
    var scanPulse = 0f
    var scanCooldown = 0f
    var miningNode: ResourceNode? = null
    var miningProgress = 0f
    var shootCooldown = 0f
    var hitFlash = 0f
    var alertTimer = 0f
    var totalMined = 0
    var totalScanned = 0
    var faunaScanned = 0
    var message = ""
    var messageTimer = 0f

    private val seedInt = (planet.seed xor (planet.seed ushr 32)).toInt()

    init {
        spawnHeight = terrain(0f, 0f)
        generate()
    }

    fun terrain(x: Float, z: Float): Float {
        val s = seedInt
        val base = (Noise.fbm(x * 0.014f, z * 0.014f, s, 5) - 0.5f) * 31f
        val ridge = Noise.ridged(x * 0.025f + 9.7f, z * 0.025f - 3.1f, s + 313, 4) * 12f
        val detail = (Noise.fbm(x * 0.085f, z * 0.085f, s + 911, 3) - 0.5f) * 2.8f
        val raw = base + ridge + detail - 7f
        val d = Noise.distance(x, z, 0f, 0f)
        val blend = smoothStep(6f, 24f, d)
        return lerp(spawnHeight + (Noise.value(x * 0.09f, z * 0.09f, s + 77) - 0.5f) * 0.8f, raw, blend)
    }

    fun waterLevel(): Float? = when (planet.biome) {
        Biome.LUSH, Biome.TOXIC, Biome.FROZEN, Biome.EXOTIC -> spawnHeight - 2.6f
        else -> null
    }

    fun update(dt: Float, player: Player) {
        time += dt
        scanPulse = max(0f, scanPulse - dt * 0.62f)
        scanCooldown = max(0f, scanCooldown - dt)
        shootCooldown = max(0f, shootCooldown - dt)
        hitFlash = max(0f, hitFlash - dt * 2.3f)
        messageTimer = max(0f, messageTimer - dt)

        val hazardDrain = if (planet.biome.hazard == HazardType.NONE) 0f else planet.biome.hazard.drain * 0.045f
        player.oxygen = max(0f, player.oxygen - dt * 0.11f)
        player.hazard = max(0f, player.hazard - dt * hazardDrain)
        if (player.oxygen <= 0f || player.hazard <= 0f) {
            player.damage(dt * 7.5f)
            hitFlash = max(hitFlash, 0.35f)
        } else if (player.shield < 100f) {
            player.shield = min(100f, player.shield + dt * 0.18f)
        }

        if (player.wanted > 0) {
            alertTimer += dt
            if (alertTimer > 18f) {
                alertTimer = 0f
                player.wanted = max(0, player.wanted - 1)
            }
            if (sentinels.count { it.alive } < player.wanted.coerceAtMost(5)) {
                spawnSentinel(player)
            }
        } else {
            alertTimer = 0f
        }

        for (s in sentinels) {
            if (!s.alive) continue
            s.phase += dt
            s.cooldown -= dt
            val dx = player.x - s.x
            val dz = player.z - s.z
            val dist = sqrt(dx * dx + dz * dz)
            if (dist > 1.5f) {
                val speed = if (dist < 45f) 3.6f else 1.0f
                s.x += dx / dist * speed * dt
                s.z += dz / dist * speed * dt
            }
            if (dist < 24f && s.cooldown <= 0f) {
                s.cooldown = 1.1f + (s.id % 3) * 0.12f
                player.damage(5.5f + player.wanted * 1.1f)
                hitFlash = 0.55f
                toast("Impacto de centinela · escudo ${player.shield.toInt()}%")
            }
            if (dist > 90f) {
                s.x = player.x + (if (s.id % 2 == 0) 35f else -35f)
                s.z = player.z + (if (s.id % 3 == 0) -32f else 32f)
            }
        }

        for (f in fauna) {
            val angle = f.phase + time * 0.23f + f.x * 0.01f
            f.angle = angle
            f.x += cos(angle) * dt * 0.55f
            f.z += sin(angle) * dt * 0.55f
            if (Noise.distance(f.x, f.z, player.x, player.z) > 90f) {
                f.x = player.x + sin(time + f.phase) * 32f
                f.z = player.z + cos(time * 0.7f + f.phase) * 32f
            }
        }
    }

    fun toast(text: String) {
        message = text
        messageTimer = 3.2f
    }

    fun scan(player: Player): Boolean {
        if (scanCooldown > 0f) return false
        if (player.scannerCharges <= 0) {
            toast("Escáner recargando · sintetiza una carga")
            return false
        }
        player.scannerCharges--
        scanCooldown = 1.4f
        scanPulse = 1f
        var newNodes = 0
        var reward = 0
        for (n in nodes) {
            if (n.depleted) continue
            val d = Noise.distance(n.x, n.z, player.x, player.z)
            if (d < 44f && !n.scanned) {
                n.scanned = true
                newNodes++
                reward += 25 + player.scannerLevel * 8
                totalScanned++
            }
        }
        for (f in fauna) {
            val d = Noise.distance(f.x, f.z, player.x, player.z)
            if (d < 54f && !f.scanned) {
                f.scanned = true
                faunaScanned++
                reward += 120
                player.nanites += 2
                toast("Fauna catalogada: ${f.name} · +2 nanitos")
            }
        }
        if (reward > 0) {
            player.units += reward
            if (messageTimer <= 0.1f) toast("Escaneo completado · +$reward unidades")
        } else if (messageTimer <= 0.1f) {
            toast(if (newNodes == 0) "Sin firmas nuevas en el radio" else "Recursos ya catalogados")
        }
        return true
    }

    fun mineTick(dt: Float, player: Player): ResourceNode? {
        val target = aimNode(player)
        if (target == null) {
            miningNode = null
            miningProgress = 0f
            return null
        }
        if (miningNode !== target) {
            miningNode = target
            miningProgress = 0f
        }
        miningProgress += dt * (1.3f + player.miningLevel * 0.18f)
        if (miningProgress >= 0.52f) {
            miningProgress = 0f
            val extracted = min(target.amount, 2 + player.miningLevel)
            target.amount -= extracted
            player.add(target.resource, extracted)
            totalMined += extracted
            if (target.amount <= 0) {
                target.depleted = true
                toast("${target.resource.label} agotado · veta sellada")
                player.wanted = min(5, player.wanted + 1)
                alertTimer = 0f
            } else {
                if (player.wanted == 0 && totalMined % 18 == 0) {
                    player.wanted = 1
                    alertTimer = 0f
                    toast("Centinelas detectados · extracción no autorizada")
                }
            }
        }
        return target
    }

    fun shoot(player: Player): Boolean {
        if (shootCooldown > 0f) return false
        shootCooldown = 0.26f
        val target = aimSentinel(player)
        if (target != null) {
            target.health -= 34f + player.miningLevel * 4f
            if (target.health <= 0f) {
                target.alive = false
                player.nanites += 3
                player.units += 70
                toast("Centinela neutralizado · +3 nanitos")
                if (sentinels.none { it.alive }) {
                    player.wanted = max(0, player.wanted - 1)
                    alertTimer = 0f
                }
            }
            return true
        }
        return false
    }

    fun aimNode(player: Player): ResourceNode? {
        var best: ResourceNode? = null
        var bestScore = 0.58f
        for (n in nodes) {
            if (n.depleted) continue
            val dx = n.x - player.x
            val dz = n.z - player.z
            val dist = sqrt(dx * dx + dz * dz)
            if (dist > 9.5f || dist < 0.1f) continue
            val dot = (dx / dist) * sin(player.yaw) + (dz / dist) * cos(player.yaw)
            val score = dot - dist * 0.012f
            if (dot > 0.5f && score > bestScore) {
                bestScore = score
                best = n
            }
        }
        return best
    }

    fun aimSentinel(player: Player): Sentinel? {
        var best: Sentinel? = null
        var bestScore = 0.65f
        for (s in sentinels) {
            if (!s.alive) continue
            val dx = s.x - player.x
            val dz = s.z - player.z
            val dist = sqrt(dx * dx + dz * dz)
            if (dist > 42f || dist < 0.1f) continue
            val dot = (dx / dist) * sin(player.yaw) + (dz / dist) * cos(player.yaw)
            val score = dot - dist * 0.006f
            if (dot > 0.62f && score > bestScore) {
                bestScore = score
                best = s
            }
        }
        return best
    }

    fun nearestNodeInfo(player: Player): ResourceNode? {
        var best: ResourceNode? = null
        var bestD = Float.MAX_VALUE
        for (n in nodes) {
            if (n.depleted) continue
            val d = Noise.distance(n.x, n.z, player.x, player.z)
            if (d < bestD) {
                bestD = d
                best = n
            }
        }
        return best
    }

    fun discoveredRatio(): Float {
        val total = nodes.size + fauna.size
        if (total == 0) return 0f
        val found = nodes.count { it.scanned } + fauna.count { it.scanned }
        return found.toFloat() / total.toFloat()
    }

    private fun spawnSentinel(player: Player) {
        val angle = (sentinels.size * 1.7f + time * 0.4f)
        val dist = 26f + (sentinels.size % 4) * 8f
        sentinels.add(
            Sentinel(
                id = sentinels.size + (time * 10).toInt(),
                x = player.x + sin(angle) * dist,
                z = player.z + cos(angle) * dist,
                phase = angle
            )
        )
    }

    private fun generate() {
        val rng = Rng(planet.seed xor 0x5DEECE66DL)
        val resourcePool = planet.resources
        var id = 0
        repeat(88) {
            val angle = rng.range(0f, (PI * 2).toFloat())
            val dist = 6f + sqrt(rng.nextFloat()) * 78f
            val x = sin(angle) * dist
            val z = cos(angle) * dist
            val resource = resourcePool[rng.nextInt(resourcePool.size)]
            val biomeWeight = when (resource) {
                ResourceType.CARBON -> 0.55f
                ResourceType.FERRITE -> 0.32f
                ResourceType.SODIUM -> 0.22f
                ResourceType.OXYGEN -> 0.20f
                ResourceType.DIHYDROGEN -> 0.18f
                else -> 0.12f
            }
            if (rng.chance(biomeWeight)) {
                val shape = when (resource) {
                    ResourceType.CARBON, ResourceType.OXYGEN -> NodeShape.PLANT
                    ResourceType.FERRITE, ResourceType.COPPER, ResourceType.GOLD -> NodeShape.ORE
                    ResourceType.SODIUM, ResourceType.DIHYDROGEN -> NodeShape.CRYSTAL
                    else -> NodeShape.POD
                }
                nodes.add(
                    ResourceNode(
                        id = id++,
                        resource = resource,
                        x = x,
                        z = z,
                        size = rng.range(0.55f, 1.5f),
                        shape = shape,
                        amount = 18 + rng.nextInt(34)
                    )
                )
            }
        }
        repeat(130) {
            val angle = rng.range(0f, (PI * 2).toFloat())
            val dist = 4f + sqrt(rng.nextFloat()) * 105f
            val tint = when (rng.nextInt(4)) {
                0 -> planet.biome.accent
                1 -> planet.biome.high
                2 -> planet.biome.mid
                else -> 0xFF57D9FF.toInt()
            }
            flora.add(
                Flora(
                    x = sin(angle) * dist,
                    z = cos(angle) * dist,
                    height = rng.range(1.4f, 6.5f),
                    width = rng.range(0.35f, 1.15f),
                    type = rng.nextInt(3),
                    tint = tint,
                    sway = rng.range(0f, 6.28f)
                )
            )
        }
        repeat(72) {
            val angle = rng.range(0f, (PI * 2).toFloat())
            val dist = 3f + sqrt(rng.nextFloat()) * 98f
            rocks.add(
                Rock(
                    x = sin(angle) * dist,
                    z = cos(angle) * dist,
                    size = rng.range(0.35f, 2.2f),
                    tint = planet.biome.mid
                )
            )
        }
        repeat((planet.fauna / 2).coerceIn(2, 8)) {
            val angle = rng.range(0f, (PI * 2).toFloat())
            val dist = 12f + sqrt(rng.nextFloat()) * 66f
            val name = planet.faunaNames.getOrElse(it) { "Especie ${it + 1}" }
            fauna.add(
                Fauna(
                    name = name,
                    x = sin(angle) * dist,
                    z = cos(angle) * dist,
                    size = rng.range(0.8f, 2.4f),
                    tint = if (it % 2 == 0) planet.biome.accent else planet.biome.high,
                    phase = rng.range(0f, 6.28f)
                )
            )
        }
    }

    fun spaceAntenna(player: Player): Float {
        return atan2(shipX - player.x, shipZ - player.z)
    }

    companion object {
        fun smoothStep(edge0: Float, edge1: Float, x: Float): Float {
            val t = ((x - edge0) / (edge1 - edge0)).coerceIn(0f, 1f)
            return t * t * (3f - 2f * t)
        }

        fun lerp(a: Float, b: Float, t: Float): Float = a + (b - a) * t

        fun yawDegrees(yaw: Float): Int {
            var deg = Math.toDegrees(yaw.toDouble()).toInt() % 360
            if (deg < 0) deg += 360
            return deg
        }

        fun compass(yaw: Float): String {
            val deg = yawDegrees(yaw)
            val dirs = listOf("N", "NE", "E", "SE", "S", "SO", "O", "NO")
            return dirs[((deg + 22) / 45) % 8]
        }

        fun angleDiff(a: Float, b: Float): Float {
            var d = a - b
            while (d > PI) d -= (PI * 2).toFloat()
            while (d < -PI) d += (PI * 2).toFloat()
            return abs(d)
        }
    }
}
