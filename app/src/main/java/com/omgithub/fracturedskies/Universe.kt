package com.omgithub.fracturedskies

import java.util.Locale

enum class StarClass(val label: String, val color: Int, val warpRequirement: Int, val description: String) {
    YELLOW("G", 0xFFFFD27A.toInt(), 0, "Estrella amarilla · rutas seguras"),
    RED("K", 0xFFFF6B5E.toInt(), 1, "Enana roja · metales raros"),
    GREEN("E", 0xFF5EF2A1.toInt(), 2, "Estrella esmeralda · biología exótica"),
    BLUE("B", 0xFF6EC8FF.toInt(), 3, "Gigante azul · tecnología ancestral")
}

enum class EconomyType(val label: String, val glyph: String) {
    MINING("Minería", "⛏"),
    TECHNOLOGY("Tecnología", "⌬"),
    ENERGY("Energía", "ϟ"),
    AGRICULTURE("Agricultura", "♧"),
    TRADE("Comercio", "◇"),
    RESEARCH("Investigación", "◎")
}

enum class ResourceType(
    val label: String,
    val symbol: String,
    val color: Int,
    val basePrice: Int,
    val short: String
) {
    CARBON("Carbono", "C", 0xFFFF7B4D.toInt(), 24, "Combustible orgánico"),
    FERRITE("Ferrita", "Fe", 0xFFB8C6D9.toInt(), 32, "Aleaciones y blindaje"),
    SODIUM("Sodio", "Na", 0xFFFFD85E.toInt(), 42, "Escudos ambientales"),
    OXYGEN("Oxígeno", "O₂", 0xFF57D9FF.toInt(), 38, "Soporte vital"),
    DIHYDROGEN("Dihidrógeno", "H₂", 0xFFB78CFF.toInt(), 46, "Combustible de nave"),
    COPPER("Cobre", "Cu", 0xFFFF9D5C.toInt(), 76, "Conductores avanzados"),
    COBALT("Cobalto", "Co", 0xFF5C8CFF.toInt(), 88, "Tecnología de salto"),
    URANIUM("Uranio", "U", 0xFFB4FF5C.toInt(), 120, "Núcleos de energía"),
    EMERIL("Emerilio", "Em", 0xFF5CFFC8.toInt(), 165, "Aleación exótica"),
    GOLD("Oro", "Au", 0xFFFFE27A.toInt(), 205, "Comercio de lujo"),
    PARAFINIUM("Parafinio", "Pf", 0xFFFF6EC8.toInt(), 190, "Combustible de hiperimpulsor"),
    CHROMATIC("Cromo", "Ch", 0xFFCF7BFF.toInt(), 240, "Material de élite")
}

enum class HazardType(val label: String, val icon: String, val drain: Float, val tint: Int) {
    NONE("Templado", "◌", 0f, 0xFF57D9FF.toInt()),
    HEAT("Calor extremo", "☀", 4.5f, 0xFFFF7B4D.toInt()),
    COLD("Frío criogénico", "❄", 4.0f, 0xFF6EC8FF.toInt()),
    TOXIC("Atmósfera tóxica", "☣", 5.0f, 0xFFB4FF5C.toInt()),
    RADIATION("Radiación", "☢", 5.5f, 0xFFB78CFF.toInt()),
    STORM("Tormenta iónica", "ϟ", 7.0f, 0xFFFFD85E.toInt())
}

enum class Biome(
    val label: String,
    val description: String,
    val skyTop: Int,
    val skyMid: Int,
    val skyHorizon: Int,
    val fog: Int,
    val low: Int,
    val mid: Int,
    val high: Int,
    val accent: Int,
    val hazard: HazardType,
    val weather: List<String>,
    val resources: List<ResourceType>
) {
    LUSH(
        "Jardín exuberante",
        "Vida fotosintética densa y océanos poco profundos.",
        0xFF071525.toInt(), 0xFF174A5A.toInt(), 0xFFE18C6B.toInt(), 0xFF8D7B86.toInt(),
        0xFF223B32.toInt(), 0xFF3D8A5D.toInt(), 0xFFE8D77B.toInt(), 0xFF69F0AE.toInt(),
        HazardType.NONE,
        listOf("Brisa fresca", "Lluvia ligera", "Niebla esporádica"),
        listOf(ResourceType.CARBON, ResourceType.OXYGEN, ResourceType.DIHYDROGEN, ResourceType.COPPER)
    ),
    SCORCHED(
        "Mundo abrasado",
        "Corteza fracturada por siglos de radiación solar.",
        0xFF1A0D0B.toInt(), 0xFF6B2A19.toInt(), 0xFFFF9B5B.toInt(), 0xFFD56B45.toInt(),
        0xFF4A211B.toInt(), 0xFF9C462A.toInt(), 0xFFFFC46B.toInt(), 0xFFFF6B4A.toInt(),
        HazardType.HEAT,
        listOf("Calor abrasador", "Vientos de ceniza", "Tormenta térmica"),
        listOf(ResourceType.FERRITE, ResourceType.SODIUM, ResourceType.COPPER, ResourceType.URANIUM)
    ),
    FROZEN(
        "Tundra criogénica",
        "Glaciares azules y formas de vida crioprotectoras.",
        0xFF06101E.toInt(), 0xFF1D3E5C.toInt(), 0xFFBFE7F2.toInt(), 0xFF9CC6D8.toInt(),
        0xFF29465C.toInt(), 0xFF6E9EB8.toInt(), 0xFFE8FBFF.toInt(), 0xFF6EC8FF.toInt(),
        HazardType.COLD,
        listOf("Nieve cristalina", "Ventisca", "Frío profundo"),
        listOf(ResourceType.DIHYDROGEN, ResourceType.SODIUM, ResourceType.COBALT, ResourceType.EMERIL)
    ),
    TOXIC(
        "Pantano tóxico",
        "Esporas corrosivas flotan sobre mares ácidos.",
        0xFF101A0A.toInt(), 0xFF354D18.toInt(), 0xFFB7C76B.toInt(), 0xFF76864A.toInt(),
        0xFF24351A.toInt(), 0xFF5A7C2E.toInt(), 0xFFD7E86B.toInt(), 0xFFB4FF5C.toInt(),
        HazardType.TOXIC,
        listOf("Lluvia ácida", "Niebla de esporas", "Aire corrosivo"),
        listOf(ResourceType.CARBON, ResourceType.FERRITE, ResourceType.SODIUM, ResourceType.EMERIL)
    ),
    RADIOACTIVE(
        "Páramo irradiado",
        "Isótopos inestables iluminan la noche con un verde imposible.",
        0xFF0C0E1A.toInt(), 0xFF293765.toInt(), 0xFF8B9CFF.toInt(), 0xFF6675B8.toInt(),
        0xFF252A45.toInt(), 0xFF4B5685.toInt(), 0xFFC6D2FF.toInt(), 0xFFB78CFF.toInt(),
        HazardType.RADIATION,
        listOf("Tormenta de partículas", "Aurora radiactiva", "Viento iónico"),
        listOf(ResourceType.URANIUM, ResourceType.FERRITE, ResourceType.COBALT, ResourceType.CHROMATIC)
    ),
    EXOTIC(
        "Anomalía cromática",
        "La física local presenta lecturas que no deberían existir.",
        0xFF1A0B23.toInt(), 0xFF5A1D70.toInt(), 0xFFFF86C8.toInt(), 0xFFB86AA0.toInt(),
        0xFF30173D.toInt(), 0xFF6E2E7C.toInt(), 0xFFFFB7E8.toInt(), 0xFFFF6EC8.toInt(),
        HazardType.STORM,
        listOf("Tormenta anómala", "Distorsión temporal", "Lluvia de cristales"),
        listOf(ResourceType.GOLD, ResourceType.CHROMATIC, ResourceType.PARAFINIUM, ResourceType.COBALT)
    ),
    BARREN(
        "Luna estéril",
        "Polvo antiguo, cráteres silenciosos y ecos de máquinas.",
        0xFF111318.toInt(), 0xFF343A45.toInt(), 0xFFC2C7D0.toInt(), 0xFF8A8F9A.toInt(),
        0xFF2A2D34.toInt(), 0xFF5D626C.toInt(), 0xFFD5D9E0.toInt(), 0xFFB8C6D9.toInt(),
        HazardType.NONE,
        listOf("Vacío tenue", "Polvo lunar", "Silencio absoluto"),
        listOf(ResourceType.FERRITE, ResourceType.COPPER, ResourceType.GOLD, ResourceType.CHROMATIC)
    )
}

data class Planet(
    val name: String,
    val seed: Long,
    val biome: Biome,
    val weather: String,
    val sentinelLevel: Int,
    val flora: Int,
    val fauna: Int,
    val faunaNames: List<String>,
    val resources: List<ResourceType>,
    val radiusKm: Int,
    val discovered: Boolean = false,
    val customName: String? = null
) {
    val displayName: String get() = customName ?: name
}

data class StarSystem(
    val index: Int,
    val name: String,
    val seed: Long,
    val starClass: StarClass,
    val economy: EconomyType,
    val wealth: Int,
    val conflict: Int,
    val planets: List<Planet>,
    val stationName: String,
    val distance: Float,
    val discovered: Boolean = false
) {
    val wealthLabel: String
        get() = when (wealth) {
            3 -> "Próspero"
            2 -> "Estable"
            else -> "Pobre"
        }
    val conflictLabel: String
        get() = when (conflict) {
            3 -> "Guerra"
            2 -> "Inestable"
            else -> "Pacífico"
        }
}

class Universe(val galaxySeed: Long) {
    private val systems = HashMap<Int, StarSystem>()
    var currentSystemIndex: Int = 0
        private set
    var currentPlanetIndex: Int = 0
        private set
    var discoveredCount: Int = 0

    private val names = listOf(
        "Ae", "Ori", "Nyx", "Kal", "Ve", "Zan", "Tor", "Ly", "Ura", "Xen", "Hel", "Rho",
        "Cy", "Aur", "Mor", "Ix", "Vael", "Sol", "Nara", "Ty", "Oth", "Quel", "Eos", "Dra",
        "Ily", "Vex", "Nor", "Tal", "Zen", "Oma", "Ryn", "Cae", "Ul", "Mira", "Sable", "Vey"
    )
    private val endings = listOf(
        "ion", "ara", "eth", "os", "ys", "um", "ax", "is", "or", "a", "ei", "un", "ara", "esh"
    )
    private val greek = listOf(
        "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta", "Iota", "Kappa",
        "Lambda", "Sigma", "Omega"
    )

    init {
        systemAt(0)
    }

    fun currentSystem(): StarSystem = systemAt(currentSystemIndex)
    fun currentPlanet(): Planet = currentSystem().planets[currentPlanetIndex.coerceIn(0, currentSystem().planets.lastIndex)]

    fun systemAt(index: Int): StarSystem = systems.getOrPut(index) { generateSystem(index) }

    fun selectSystem(index: Int) {
        currentSystemIndex = index.coerceAtLeast(0)
        currentPlanetIndex = 0
        systemAt(currentSystemIndex)
    }

    fun selectPlanet(index: Int) {
        currentPlanetIndex = index.coerceIn(0, currentSystem().planets.lastIndex)
    }

    fun nearbySystemIndices(count: Int = 9): List<Int> {
        val start = currentSystemIndex
        return (0 until count).map { start + it }
    }

    fun registerDiscovery() {
        discoveredCount++
    }

    private fun generateSystem(index: Int): StarSystem {
        val rng = Rng(galaxySeed xor (index.toLong() * -0x61c8864680b583ebL) xor 0x51ED2701L)
        val starClass = when {
            index == 0 -> StarClass.YELLOW
            else -> {
                val roll = rng.nextFloat()
                when {
                    roll < 0.50f -> StarClass.YELLOW
                    roll < 0.70f -> StarClass.RED
                    roll < 0.87f -> StarClass.GREEN
                    else -> StarClass.BLUE
                }
            }
        }
        val name = buildName(rng, 2)
        val economy = EconomyType.entries[rng.nextInt(EconomyType.entries.size)]
        val wealth = 1 + rng.nextInt(3)
        val conflict = 1 + rng.nextInt(3)
        val planetCount = 2 + rng.nextInt(4)
        val planets = ArrayList<Planet>()
        val available = Biome.entries.toList()
        repeat(planetCount) { p ->
            val biome = if (p == 0 && index == 0) Biome.LUSH else available[rng.nextInt(available.size)]
            val hazard = biome.hazard
            val weather = biome.weather[rng.nextInt(biome.weather.size)]
            val fauna = if (biome == Biome.BARREN) rng.nextInt(3) else 3 + rng.nextInt(12)
            val flora = if (biome == Biome.BARREN) rng.nextInt(3) else 5 + rng.nextInt(15)
            val resourcePool = biome.resources.toMutableList()
            for (i in resourcePool.indices.reversed()) {
                val j = rng.nextInt(i + 1)
                val tmp = resourcePool[i]
                resourcePool[i] = resourcePool[j]
                resourcePool[j] = tmp
            }
            val resources = resourcePool.take(3 + rng.nextInt(2))
            val faunaNames = List(fauna.coerceAtMost(4)) { faunaName(rng) }
            val planetName = if (p == 0) name else "${name} ${greek[p % greek.size]}"
            planets.add(
                Planet(
                    name = planetName,
                    seed = rng.nextLong() xor (index.toLong() shl 17) xor p.toLong(),
                    biome = biome,
                    weather = weather,
                    sentinelLevel = 1 + rng.nextInt(3) + (if (hazard == HazardType.STORM) 1 else 0),
                    flora = flora,
                    fauna = fauna,
                    faunaNames = faunaNames,
                    resources = resources,
                    radiusKm = 1800 + rng.nextInt(9800)
                )
            )
        }
        val stationPrefix = listOf("Estación", "Puesto", "Anclaje", "Nexo", "Faro")[rng.nextInt(5)]
        return StarSystem(
            index = index,
            name = name,
            seed = rng.nextLong(),
            starClass = starClass,
            economy = economy,
            wealth = wealth,
            conflict = conflict,
            planets = planets,
            stationName = "$stationPrefix ${buildName(rng, 1)}",
            distance = 0.12f + index * 0.037f
        )
    }

    private fun buildName(rng: Rng, parts: Int): String {
        val sb = StringBuilder()
        repeat(parts) { sb.append(names[rng.nextInt(names.size)]) }
        sb.append(endings[rng.nextInt(endings.size)])
        return sb.toString()
    }

    private fun faunaName(rng: Rng): String {
        val a = listOf("Ryl", "Vex", "Thal", "Ora", "Kesh", "Uln", "Tir", "Nai", "Quo", "Sel")
        val b = listOf("ak", "oth", "eri", "ux", "ana", "ide", "ora", "yn", "esh")
        return a[rng.nextInt(a.size)] + b[rng.nextInt(b.size)]
    }

    fun systemDescription(system: StarSystem): String {
        return String.format(
            Locale.US,
            "%s · %s · Riqueza: %s · Conflicto: %s · %d planetas",
            system.starClass.label,
            system.economy.label,
            system.wealthLabel,
            system.conflictLabel,
            system.planets.size
        )
    }
}
