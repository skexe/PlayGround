package com.omgithub.fracturedskies

import android.content.Context
import android.graphics.Canvas
import android.graphics.RectF
import android.view.MotionEvent
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

enum class Screen {
    TITLE, SURFACE, SPACE, GALAXY, STATION, INVENTORY, CRAFT, CODEX, PAUSE, WARP
}

enum class ButtonStyle { PRIMARY, GHOST, ACTION, DANGER, SMALL, TAB }

data class UiButton(
    val action: String,
    val rect: RectF,
    val label: String,
    val style: ButtonStyle = ButtonStyle.GHOST,
    val sublabel: String? = null,
    val icon: String? = null,
    val accent: Int = 0xFF37F2D4.toInt(),
    val hold: Boolean = false,
    val enabled: Boolean = true
)

data class Recipe(
    val id: String,
    val name: String,
    val description: String,
    val costs: Map<ResourceType, Int>,
    val output: String
)

class Game(context: Context) {

    val appContext = context.applicationContext
    val prefs = appContext.getSharedPreferences("fractured_skies", Context.MODE_PRIVATE)
    val galaxySeed = 0x4E4D5321A17L

    var universe = Universe(galaxySeed)
    var player = Player()
    var world: SurfaceWorld = SurfaceWorld(universe.currentPlanet())
    val renderer = GameRenderer(this)

    var screen = Screen.TITLE
    var previousScreen = Screen.SURFACE
    var width = 1920
    var height = 1080
    var time = 0f
    var hasSave = false
    var gameStarted = false
    var paused = false

    var uiButtons: List<UiButton> = emptyList()
    var hoveredAction: String? = null
    var toastText = ""
    var toastTime = 0f
    var toastAccent = 0xFF37F2D4.toInt()

    var joystickX = 0f
    var joystickY = 0f
    var joystickActive = false
    var lookSensitivity = 1f
    var joystickBaseX = 0f
    var joystickBaseY = 0f
    var joystickRadius = 120f

    var miningHeld = false
    var shootingHeld = false
    var jetpackHeld = false

    var elevation = 0f
    var elevationVelocity = 0f
    var headBob = 0f
    var cameraHeight = 0f
    var damageFlash = 0f
    var warpT = 0f
    var warpFrom = 0
    var warpTo = 1
    var selectedPlanet = 0
    var galaxySelection = 0
    var stationTab = 0
    var scanEffect = 0f
    var landingFlash = 0f
    var missionStep = 0
    var savedScreen = Screen.SURFACE
    var autosaveAt = 0f

    val recipes = listOf(
        Recipe(
            "support", "Célula de soporte",
            "Restaura 45% del soporte vital.",
            mapOf(ResourceType.OXYGEN to 2, ResourceType.CARBON to 2),
            "+45 O₂"
        ),
        Recipe(
            "shield", "Placa de escudo",
            "Restaura el escudo del exotraje.",
            mapOf(ResourceType.FERRITE to 6, ResourceType.SODIUM to 2),
            "+45 ESCUDO"
        ),
        Recipe(
            "launch", "Combustible de despegue",
            "Añade una carga de lanzamiento.",
            mapOf(ResourceType.DIHYDROGEN to 3, ResourceType.FERRITE to 2),
            "+1 LANZAMIENTO"
        ),
        Recipe(
            "warp", "Célula de deformación",
            "Combustible para el hiperimpulsor.",
            mapOf(ResourceType.SODIUM to 4, ResourceType.DIHYDROGEN to 4, ResourceType.COPPER to 2),
            "+1 SALTO"
        ),
        Recipe(
            "scan", "Carga de escáner",
            "Recarga el pulso de exploración.",
            mapOf(ResourceType.CARBON to 2, ResourceType.SODIUM to 1),
            "+1 ESCANEO"
        ),
        Recipe(
            "jet", "Inyector de jetpack",
            "Recarga el propulsor personal.",
            mapOf(ResourceType.CARBON to 3, ResourceType.FERRITE to 2),
            "+100 JETPACK"
        )
    )

    private val touchPoints = HashMap<Int, TouchPoint>()
    private var heldButton: UiButton? = null

    private data class TouchPoint(
        var mode: Int,
        var lastX: Float,
        var lastY: Float,
        var startX: Float,
        var startY: Float
    )

    private companion object {
        const val MODE_LOOK = 0
        const val MODE_JOYSTICK = 1
    }

    init {
        hasSave = prefs.contains("save")
        cameraHeight = world.terrain(0f, 0f) + 1.7f
    }

    fun resize(w: Int, h: Int) {
        width = max(1, w)
        height = max(1, h)
        joystickRadius = min(width, height) * 0.11f
    }

    fun resume() {
        paused = false
    }

    fun pause() {
        paused = true
        if (gameStarted) save()
    }

    fun update(dt: Float) {
        time += dt
        toastTime = max(0f, toastTime - dt)
        scanEffect = max(0f, scanEffect - dt * 1.9f)
        damageFlash = max(0f, damageFlash - dt * 2.1f)
        landingFlash = max(0f, landingFlash - dt * 1.5f)
        if (screen == Screen.SURFACE) updateSurface(dt)
        if (screen == Screen.WARP) updateWarp(dt)
        if (screen == Screen.SPACE || screen == Screen.GALAXY) updateSpace(dt)
        if (screen == Screen.SURFACE && player.health <= 0f) {
            player.respawn()
            elevation = 0f
            elevationVelocity = 0f
            toast("Exotraje reconstituido · recursos perdidos", 0xFFFF7B4D.toInt())
            val lost = player.totalResources() / 8
            player.inventory.keys.toList().forEach { key ->
                player.take(key, min(player.amount(key), lost / player.inventory.size.coerceAtLeast(1)))
            }
        }
        if (screen != Screen.WARP && screen != Screen.TITLE && time - autosaveAt > 20f) {
            autosaveAt = time
            save()
        }
    }

    private fun updateSurface(dt: Float) {
        val moveX = joystickX
        val moveY = joystickY
        val len = sqrt(moveX * moveX + moveY * moveY)
        val speed = 5.8f
        if (len > 0.05f) {
            val nx = moveX / max(1f, len)
            val nz = moveY / max(1f, len)
            val forward = -nz
            val strafe = nx
            player.x += (sin(player.yaw) * forward + cos(player.yaw) * strafe) * speed * dt
            player.z += (cos(player.yaw) * forward - sin(player.yaw) * strafe) * speed * dt
            headBob += dt * speed * 1.8f
        } else {
            headBob += dt * 0.8f
        }

        if (jetpackHeld && player.jetpack > 0f) {
            player.jetpack = max(0f, player.jetpack - dt * 21f)
            elevationVelocity = max(elevationVelocity, 3.6f)
            elevation = min(9f, elevation + elevationVelocity * dt)
        } else {
            elevationVelocity -= 15f * dt
            elevation = max(0f, elevation + elevationVelocity * dt)
            if (elevation <= 0f) elevationVelocity = 0f
            if (player.jetpack < 100f) player.jetpack = min(100f, player.jetpack + dt * 0.7f)
        }

        world.update(dt, player)
        if (miningHeld) {
            world.mineTick(dt, player)
        } else {
            world.miningNode = null
            world.miningProgress = 0f
        }
        if (shootingHeld) world.shoot(player)

        val ground = world.terrain(player.x, player.z)
        cameraHeight = ground + 1.68f + elevation + sin(headBob) * 0.035f
        if (world.hitFlash > damageFlash) damageFlash = world.hitFlash
        if (player.health <= 0f) {
            damageFlash = 1f
        }
    }

    private fun updateSpace(dt: Float) {
        landingFlash = max(0f, landingFlash - dt)
    }

    private fun updateWarp(dt: Float) {
        warpT += dt * 0.48f
        if (warpT >= 1f) {
            warpT = 0f
            universe.selectSystem(warpTo)
            selectedPlanet = 0
            world = SurfaceWorld(universe.currentPlanet())
            player.resetAtSurface()
            screen = Screen.SPACE
            landingFlash = 1f
            toast("Llegada a ${universe.currentSystem().name} · ${universe.currentSystem().starClass.label}", 0xFF6EC8FF.toInt())
            save()
        }
    }

    fun draw(canvas: Canvas) {
        renderer.draw(canvas)
    }

    fun toast(text: String, accent: Int = 0xFF37F2D4.toInt()) {
        toastText = text
        toastTime = 4.2f
        toastAccent = accent
    }

    fun startExpedition() {
        universe = Universe(galaxySeed)
        player = Player()
        player.resetAtSurface()
        world = SurfaceWorld(universe.currentPlanet())
        selectedPlanet = 0
        galaxySelection = 0
        screen = Screen.SURFACE
        gameStarted = true
        missionStep = 0
        cameraHeight = world.terrain(player.x, player.z) + 1.7f
        landingFlash = 1.2f
        save()
        toast("Señal de emergencia localizada · exotraje en línea")
    }

    fun continueExpedition() {
        if (!load()) startExpedition()
        else {
            gameStarted = true
            screen = savedScreen
            landingFlash = 1f
        }
    }

    fun save() {
        if (!gameStarted) return
        try {
            val json = JSONObject()
            json.put("system", universe.currentSystemIndex)
            json.put("planet", universe.currentPlanetIndex)
            json.put("units", player.units)
            json.put("nanites", player.nanites)
            json.put("health", player.health.toDouble())
            json.put("shield", player.shield.toDouble())
            json.put("hazard", player.hazard.toDouble())
            json.put("oxygen", player.oxygen.toDouble())
            json.put("jetpack", player.jetpack.toDouble())
            json.put("wanted", player.wanted)
            json.put("warpCells", player.warpCells)
            json.put("launchFuel", player.launchFuel)
            json.put("hyperdrive", player.hyperdriveLevel)
            json.put("mining", player.miningLevel)
            json.put("scanner", player.scannerLevel)
            json.put("scannerCharges", player.scannerCharges)
            json.put("px", player.x.toDouble())
            json.put("pz", player.z.toDouble())
            json.put("yaw", player.yaw.toDouble())
            json.put("pitch", player.pitch.toDouble())
            json.put("discovered", universe.discoveredCount)
            json.put("mission", missionStep)
            json.put("space", screen == Screen.SPACE || screen == Screen.GALAXY || screen == Screen.STATION)
            json.put("mined", world.totalMined)
            json.put("scanned", world.totalScanned)
            val inv = JSONObject()
            player.inventory.forEach { (k, v) -> inv.put(k.name, v) }
            json.put("inventory", inv)
            prefs.edit().putString("save", json.toString()).apply()
            hasSave = true
        } catch (_: Throwable) {
        }
    }

    fun load(): Boolean {
        val raw = prefs.getString("save", null) ?: return false
        return try {
            val json = JSONObject(raw)
            universe = Universe(galaxySeed)
            universe.selectSystem(json.optInt("system", 0))
            universe.selectPlanet(json.optInt("planet", 0))
            val p = Player()
            p.units = json.optInt("units", 2450)
            p.nanites = json.optInt("nanites", 12)
            p.health = json.optDouble("health", 100.0).toFloat()
            p.shield = json.optDouble("shield", 100.0).toFloat()
            p.hazard = json.optDouble("hazard", 100.0).toFloat()
            p.oxygen = json.optDouble("oxygen", 100.0).toFloat()
            p.jetpack = json.optDouble("jetpack", 100.0).toFloat()
            p.wanted = json.optInt("wanted", 0)
            p.warpCells = json.optInt("warpCells", 1)
            p.launchFuel = json.optInt("launchFuel", 2)
            p.hyperdriveLevel = json.optInt("hyperdrive", 0)
            p.miningLevel = json.optInt("mining", 1)
            p.scannerLevel = json.optInt("scanner", 1)
            p.scannerCharges = json.optInt("scannerCharges", 3)
            p.x = json.optDouble("px", 0.0).toFloat()
            p.z = json.optDouble("pz", 0.0).toFloat()
            p.yaw = json.optDouble("yaw", 0.32).toFloat()
            p.pitch = json.optDouble("pitch", -0.12).toFloat()
            val inv = json.optJSONObject("inventory")
            if (inv != null) {
                p.inventory.clear()
                ResourceType.entries.forEach { r ->
                    if (inv.has(r.name)) p.inventory[r] = inv.optInt(r.name)
                }
            }
            universe.selectSystem(json.optInt("system", 0))
            universe.selectPlanet(json.optInt("planet", 0))
            player = p
            world = SurfaceWorld(universe.currentPlanet())
            selectedPlanet = universe.currentPlanetIndex
            missionStep = json.optInt("mission", 0)
            savedScreen = if (json.optBoolean("space", false)) Screen.SPACE else Screen.SURFACE
            screen = savedScreen
            cameraHeight = world.terrain(player.x, player.z) + 1.7f
            true
        } catch (_: Throwable) {
            false
        }
    }

    fun back(): Boolean {
        return when (screen) {
            Screen.TITLE -> false
            Screen.SURFACE, Screen.SPACE -> {
                previousScreen = screen
                screen = Screen.PAUSE
                true
            }
            Screen.PAUSE -> {
                screen = previousScreen
                true
            }
            Screen.INVENTORY, Screen.CRAFT, Screen.STATION, Screen.GALAXY, Screen.CODEX -> {
                screen = if (previousScreen == Screen.TITLE) Screen.TITLE else previousScreen
                true
            }
            Screen.WARP -> false
        }
    }

    fun takeOff() {
        if (player.launchFuel <= 0) {
            toast("Sin combustible de lanzamiento · sintetízalo en el inventario", 0xFFFF7B4D.toInt())
            return
        }
        if (Noise.distance(player.x, player.z, world.shipX, world.shipZ) > 8f) {
            toast("La nave está a ${Noise.distance(player.x, player.z, world.shipX, world.shipZ).toInt()} m")
            return
        }
        player.launchFuel--
        screen = Screen.SPACE
        savedScreen = Screen.SPACE
        landingFlash = 1f
        save()
        toast("Despegue completado · órbita estable", 0xFF6EC8FF.toInt())
    }

    fun landOnPlanet(index: Int) {
        if (index !in universe.currentSystem().planets.indices) return
        universe.selectPlanet(index)
        selectedPlanet = index
        world = SurfaceWorld(universe.currentPlanet())
        player.resetAtSurface()
        screen = Screen.SURFACE
        previousScreen = Screen.SURFACE
        savedScreen = Screen.SURFACE
        landingFlash = 1.2f
        save()
        toast("Aterrizaje · ${universe.currentPlanet().displayName} · ${universe.currentPlanet().biome.label}")
    }

    fun openOverlay(target: Screen) {
        if (screen != Screen.INVENTORY && screen != Screen.CRAFT && screen != Screen.STATION &&
            screen != Screen.GALAXY && screen != Screen.CODEX && screen != Screen.PAUSE
        ) {
            previousScreen = screen
        }
        screen = target
        miningHeld = false
        shootingHeld = false
        jetpackHeld = false
        joystickActive = false
    }

    fun closeOverlay() {
        screen = if (previousScreen == Screen.TITLE) Screen.SURFACE else previousScreen
        if (screen == Screen.SPACE) savedScreen = Screen.SPACE
        else if (screen == Screen.SURFACE) savedScreen = Screen.SURFACE
    }

    fun initiateWarp(targetIndex: Int) {
        val target = universe.systemAt(targetIndex.coerceAtLeast(0))
        val required = target.starClass.warpRequirement
        if (player.hyperdriveLevel < required) {
            toast("Hiperimpulsor insuficiente · requiere mejora ${target.starClass.label}", 0xFFFF7B4D.toInt())
            return
        }
        if (player.warpCells <= 0) {
            toast("Sin células de deformación · fabrica una en el inventario", 0xFFFF7B4D.toInt())
            return
        }
        if (targetIndex == universe.currentSystemIndex) {
            toast("Ya estás en este sistema")
            return
        }
        player.warpCells--
        warpFrom = universe.currentSystemIndex
        warpTo = targetIndex
        warpT = 0f
        screen = Screen.WARP
        save()
    }

    fun craft(recipe: Recipe) {
        val missing = recipe.costs.filter { (resource, amount) -> player.amount(resource) < amount }
        if (missing.isNotEmpty()) {
            toast("Materiales insuficientes · ${missing.keys.first().label}", 0xFFFF7B4D.toInt())
            return
        }
        recipe.costs.forEach { (resource, amount) -> player.take(resource, amount) }
        when (recipe.id) {
            "support" -> player.oxygen = min(100f, player.oxygen + 45f)
            "shield" -> player.shield = min(100f, player.shield + 45f)
            "launch" -> player.launchFuel += 1
            "warp" -> player.warpCells += 1
            "scan" -> player.scannerCharges += 1
            "jet" -> player.jetpack = 100f
        }
        player.units += 15
        toast("Sintetizado: ${recipe.name}", 0xFF5EF2A1.toInt())
        save()
    }

    fun buy(resource: ResourceType, quantity: Int = 5) {
        val price = (resource.basePrice * 1.18f * (1.15f - universe.currentSystem().wealth * 0.05f)).toInt() * quantity
        if (player.units < price) {
            toast("Unidades insuficientes · necesitas $price", 0xFFFF7B4D.toInt())
            return
        }
        player.units -= price
        player.add(resource, quantity)
        toast("Comprado $quantity × ${resource.label} · -$price u", 0xFF5EF2A1.toInt())
        save()
    }

    fun sell(resource: ResourceType, quantity: Int = 5) {
        val have = player.amount(resource)
        if (have < quantity) {
            toast("No tienes suficiente ${resource.label}", 0xFFFF7B4D.toInt())
            return
        }
        val price = (resource.basePrice * 0.86f * (0.92f + universe.currentSystem().wealth * 0.04f)).toInt() * quantity
        player.take(resource, quantity)
        player.units += price
        toast("Vendido $quantity × ${resource.label} · +$price u", 0xFF5EF2A1.toInt())
        save()
    }

    fun purchaseUpgrade(id: String) {
        when (id) {
            "hyperdrive" -> {
                if (player.hyperdriveLevel >= 3) {
                    toast("Hiperimpulsor al máximo")
                    return
                }
                val cost = 120 + player.hyperdriveLevel * 160
                if (player.nanites < cost) {
                    toast("Nanitos insuficientes · $cost necesarios", 0xFFFF7B4D.toInt())
                    return
                }
                player.nanites -= cost
                player.hyperdriveLevel++
                toast("Hiperimpulsor clase ${'A' + player.hyperdriveLevel} instalado", 0xFF5EF2A1.toInt())
            }
            "scanner" -> {
                if (player.nanites < 40) {
                    toast("Nanitos insuficientes · 40 necesarios", 0xFFFF7B4D.toInt())
                    return
                }
                player.nanites -= 40
                player.scannerLevel++
                player.scannerCharges += 2
                toast("Escáner mejorado · nivel ${player.scannerLevel}", 0xFF5EF2A1.toInt())
            }
            "warp" -> {
                val cost = 60
                if (player.nanites < cost) {
                    toast("Nanitos insuficientes · $cost necesarios", 0xFFFF7B4D.toInt())
                    return
                }
                player.nanites -= cost
                player.warpCells++
                toast("Célula de deformación adquirida", 0xFF5EF2A1.toInt())
            }
            "fuel" -> {
                val cost = 30
                if (player.nanites < cost) {
                    toast("Nanitos insuficientes · $cost necesarios", 0xFFFF7B4D.toInt())
                    return
                }
                player.nanites -= cost
                player.launchFuel++
                toast("Combustible de lanzamiento adquirido", 0xFF5EF2A1.toInt())
            }
        }
        save()
    }

    fun onTouch(event: MotionEvent) {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                handleDown(event.getX(0), event.getY(0), 0)
            }
            MotionEvent.ACTION_POINTER_DOWN -> {
                val index = event.actionIndex
                handleDown(event.getX(index), event.getY(index), event.getPointerId(index))
            }
            MotionEvent.ACTION_MOVE -> {
                for (i in 0 until event.pointerCount) {
                    val id = event.getPointerId(i)
                    val point = touchPoints[id] ?: continue
                    val x = event.getX(i)
                    val y = event.getY(i)
                    if (point.mode == MODE_JOYSTICK) {
                        var dx = x - joystickBaseX
                        var dy = y - joystickBaseY
                        val len = sqrt(dx * dx + dy * dy)
                        if (len > joystickRadius) {
                            dx = dx / len * joystickRadius
                            dy = dy / len * joystickRadius
                        }
                        joystickX = dx / joystickRadius
                        joystickY = dy / joystickRadius
                    } else if (point.mode == MODE_LOOK) {
                        val dx = x - point.lastX
                        val dy = y - point.lastY
                        player.yaw += dx * 0.0034f * lookSensitivity
                        player.pitch = (player.pitch - dy * 0.0027f * lookSensitivity).coerceIn(-0.95f, 0.62f)
                        point.lastX = x
                        point.lastY = y
                    }
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                resetTouch()
            }
            MotionEvent.ACTION_POINTER_UP -> {
                val index = event.actionIndex
                val id = event.getPointerId(index)
                val point = touchPoints.remove(id)
                if (point?.mode == MODE_JOYSTICK) {
                    joystickActive = false
                    joystickX = 0f
                    joystickY = 0f
                }
            }
        }
    }

    private fun handleDown(x: Float, y: Float, id: Int) {
        val button = uiButtons.firstOrNull { it.rect.contains(x, y) }
        if (button != null) {
            if (button.hold) {
                heldButton = button
                when (button.action) {
                    "mine" -> miningHeld = true
                    "shoot" -> shootingHeld = true
                    "jet" -> jetpackHeld = true
                }
            } else {
                press(button.action)
            }
            return
        }
        if (screen == Screen.SURFACE) {
            if (x < width * 0.46f && y > height * 0.34f) {
                joystickActive = true
                joystickBaseX = x
                joystickBaseY = y
                joystickX = 0f
                joystickY = 0f
                touchPoints[id] = TouchPoint(MODE_JOYSTICK, x, y, x, y)
                return
            }
            touchPoints[id] = TouchPoint(MODE_LOOK, x, y, x, y)
        } else if (screen == Screen.SPACE || screen == Screen.GALAXY) {
            touchPoints[id] = TouchPoint(MODE_LOOK, x, y, x, y)
        }
    }

    private fun resetTouch() {
        touchPoints.clear()
        joystickActive = false
        joystickX = 0f
        joystickY = 0f
        miningHeld = false
        shootingHeld = false
        jetpackHeld = false
        heldButton = null
    }

    fun press(action: String) {
        when {
            action == "start" -> startExpedition()
            action == "continue" -> continueExpedition()
            action == "codex" -> {
                previousScreen = screen
                screen = Screen.CODEX
            }
            action == "resume" -> {
                screen = previousScreen
                resetTouch()
            }
            action == "save" -> {
                save()
                toast("Expedición sincronizada con el Nexo", 0xFF5EF2A1.toInt())
            }
            action == "title" -> {
                save()
                screen = Screen.TITLE
                resetTouch()
            }
            action == "inventory" -> openOverlay(Screen.INVENTORY)
            action == "craft" -> openOverlay(Screen.CRAFT)
            action == "close" -> {
                resetTouch()
                closeOverlay()
            }
            action == "menu" -> {
                previousScreen = screen
                screen = Screen.PAUSE
                resetTouch()
            }
            action == "scan" -> {
                if (world.scan(player)) scanEffect = 1f
            }
            action == "mine" -> miningHeld = true
            action == "shoot" -> shootingHeld = true
            action == "jet" -> jetpackHeld = true
            action == "takeoff" -> takeOff()
            action == "station" -> openOverlay(Screen.STATION)
            action == "galaxy" -> {
                galaxySelection = universe.currentSystemIndex
                openOverlay(Screen.GALAXY)
            }
            action == "land" -> landOnPlanet(selectedPlanet)
            action == "warp" -> {
                val target = if (galaxySelection == universe.currentSystemIndex) universe.currentSystemIndex + 1 else galaxySelection
                initiateWarp(target)
            }
            action == "recharge_oxygen" -> toast(if (player.rechargeLifeSupport()) "Soporte vital recargado" else "Oxígeno insuficiente", 0xFF57D9FF.toInt())
            action == "recharge_hazard" -> toast(if (player.rechargeHazard()) "Protección ambiental recargada" else "Sodio insuficiente", 0xFFFFD85E.toInt())
            action == "recharge_shield" -> toast(if (player.rechargeShield()) "Escudo recargado" else "Ferrita insuficiente", 0xFFB8C6D9.toInt())
            action.startsWith("craft:") -> {
                val recipe = recipes.firstOrNull { it.id == action.removePrefix("craft:") }
                if (recipe != null) craft(recipe)
            }
            action.startsWith("buy:") -> {
                runCatching { ResourceType.valueOf(action.removePrefix("buy:")) }.getOrNull()?.let { buy(it) }
            }
            action.startsWith("sell:") -> {
                runCatching { ResourceType.valueOf(action.removePrefix("sell:")) }.getOrNull()?.let { sell(it) }
            }
            action.startsWith("upgrade:") -> purchaseUpgrade(action.removePrefix("upgrade:"))
            action.startsWith("planet:") -> {
                action.removePrefix("planet:").toIntOrNull()?.let { selectedPlanet = it }
            }
            action.startsWith("system:") -> {
                action.removePrefix("system:").toIntOrNull()?.let { galaxySelection = it }
            }
            action == "repair" -> {
                toast("Sistemas del exotraje estables", 0xFF5EF2A1.toInt())
            }
        }
    }

    fun handleHeld(dt: Float) {
        if (miningHeld && screen == Screen.SURFACE) world.mineTick(dt, player)
        if (shootingHeld && screen == Screen.SURFACE) world.shoot(player)
    }

    fun objectiveText(): String {
        return when {
            screen == Screen.SPACE -> "Selecciona un destino orbital o traza un salto"
            screen == Screen.SURFACE -> when {
                world.discoveredRatio() < 0.16f -> "Escanea el ecosistema local"
                player.launchFuel == 0 -> "Sintetiza combustible de despegue"
                Noise.distance(player.x, player.z, world.shipX, world.shipZ) > 8f -> "Regresa a tu nave · ${Noise.distance(player.x, player.z, world.shipX, world.shipZ).toInt()} m"
                else -> "Despega y alcanza el núcleo galáctico"
            }
            else -> "Explora el universo procedural"
        }
    }

    fun currentHeading(): Int = SurfaceWorld.yawDegrees(player.yaw)
}
