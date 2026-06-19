// js/data.js

const learningContent = {
    A1: {
        ToBe: {
            title: "Első lecke: A \"Lenni\" Ige (The Verb \"TO BE\")",
            title_hu: "Első lecke: A \"Lenni\" Ige (The Verb \"TO BE\")",
            title_en: "Lesson 1: The Verb \"TO BE\"",
            title_sk: "Prvá lekcia: Sloveso \"BYŤ\" (The Verb \"TO BE\")",
            explanation: "Az angol \"to be\" (lenni) ige az egyik legfontosabb és leggyakrabban használt ige az angol nyelvben. Jelen időben három alakja van: <strong>am, is, are</strong>. Használjuk állapotok, tulajdonságok és foglalkozások kifejezésére.",
            subsections: {
                explanation: {
                    title: "Magyarázat",
                    icon: "📚",
                    type: "explanation",
                    content: "Az angol \"to be\" (lenni) ige az egyik legfontosabb és leggyakrabban használt ige az angol nyelvben. Jelen időben három alakja van: <strong>am, is, are</strong>."
                },
                words: {
                    title: "Szavak",
                    icon: "📖",
                    type: "words",
                    dataSource: "data/A1/Lesson1_ToBe/words.json"
                },
                fillBlanks: {
                    title: "Lyukas mondatok",
                    icon: "✏️",
                    type: "fill_blanks",
                    dataSource: "data/A1/Lesson1_ToBe/fillBlanks.json"
                },
                wordOrder: {
                    title: "Szórendezés",
                    icon: "🔀",
                    type: "word_order",
                    dataSource: "data/A1/Lesson1_ToBe/wordOrder.json"
                },
                trueFalse: {
                    title: "Igaz vagy Hamis",
                    icon: "✅",
                    type: "true_false",
                    dataSource: "data/A1/Lesson1_ToBe/trueFalse.json"
                },
                sectionExam: {
                    title: "Fejezet vizsga",
                    icon: "🏆",
                    type: "section_exam",
                    dataSource: "data/A1/Lesson1_ToBe/sectionExam.json"
                }
            }
        },
        ToHave: {
            title: "Második Lecke: A \"Birtoklás\" Ige (The Verb To Have)",
            title_hu: "Második Lecke: A \"Birtoklás\" Ige (The Verb To Have)",
            title_en: "Lesson 2: The Verb \"TO HAVE\"",
            title_sk: "Druhá lekcia: Sloveso \"MAŤ\" (The Verb \"TO HAVE\")",
            explanation: "WIP",
            subsections: {
                explanation: {
                    title: "Magyarázat",
                    icon: "📚",
                    type: "explanation",
                    content: "WIP: Hamarosan érkezik!"
                },
                words: {
                    title: "Szavak",
                    icon: "📖",
                    type: "words",
                    dataSource: "data/A1/Lesson2_ToHave/words.json"
                },
                fillBlanks: {
                    title: "Lyukas mondatok",
                    icon: "✏️",
                    type: "fill_blanks",
                    dataSource: "data/A1/Lesson2_ToHave/fillBlanks.json"
                },
                wordOrder: {
                    title: "Szórendezés",
                    icon: "🔀",
                    type: "word_order",
                    dataSource: "data/A1/Lesson2_ToHave/wordOrder.json"
                },
                trueFalse: {
                    title: "Igaz vagy Hamis",
                    icon: "✅",
                    type: "true_false",
                    dataSource: "data/A1/Lesson2_ToHave/trueFalse.json"
                },
                sectionExam: {
                    title: "Fejezet vizsga",
                    icon: "🏆",
                    type: "section_exam",
                    dataSource: "data/A1/Lesson2_ToHave/sectionExam.json"
                }
            }
        },
        Lesson3: {
            title: "Harmadik Lecke: Egyszerű Jelen Idő (Present Simple)",
            title_hu: "Harmadik Lecke: Egyszerű Jelen Idő (Present Simple)",
            title_en: "Lesson 3: Present Simple",
            title_sk: "Tretia lekcia: Jednoduchý prítomný čas (Present Simple)",
            explanation: "Az egyszerű jelen időt (Present Simple) a mindennapi szokások, rendszeres cselekvések, és általános igazságok kifejezésére használjuk az angolban.",
            subsections: {
                explanation: {
                    title: "Magyarázat",
                    icon: "📚",
                    type: "explanation",
                    content: "Az egyszerű jelen időt (Present Simple) szokások, rendszeres cselekvések és általános tények kifejezésére használjuk. Kijelentésben egyes szám harmadik személyben (he, she, it) az ige <strong>-s</strong> vagy <strong>-es</strong> ragot kap (pl. he works, she goes). Tagadáshoz és kérdésfeltevéshez a <strong>do / does</strong> segédigéket (tagadásnál: <strong>don't / doesn't</strong>) használjuk."
                },
                words: {
                    title: "Szavak",
                    icon: "📖",
                    type: "words",
                    dataSource: "data/A1/Lesson3_Present_Simple/words.json"
                },
                fillBlanks: {
                    title: "Lyukas mondatok",
                    icon: "✏️",
                    type: "fill_blanks",
                    dataSource: "data/A1/Lesson3_Present_Simple/fillBlanks.json"
                },
                wordOrder: {
                    title: "Szórendezés",
                    icon: "🔀",
                    type: "word_order",
                    dataSource: "data/A1/Lesson3_Present_Simple/wordOrder.json"
                },
                trueFalse: {
                    title: "Igaz vagy Hamis",
                    icon: "✅",
                    type: "true_false",
                    dataSource: "data/A1/Lesson3_Present_Simple/trueFalse.json"
                },
                sectionExam: {
                    title: "Fejezet vizsga",
                    icon: "🏆",
                    type: "section_exam",
                    dataSource: "data/A1/Lesson3_Present_Simple/sectionExam.json"
                }
            }
        },
        Lesson4: {
            title: "Negyedik Lecke: Névmások és Birtokos Melléknevek (Pronouns & Adjectives)",
            title_hu: "Negyedik Lecke: Névmások és Birtokos Melléknevek (Pronouns & Adjectives)",
            title_en: "Lesson 4: Pronouns & Possessive Adjectives",
            title_sk: "Štvrtá lekcia: Zámená a privlastňovacie prídavné mená (Pronouns & Adjectives)",
            explanation: "Ebben a leckében az alanyi és tárgyas névmások (pl. I, me), valamint a birtokos melléknevek (pl. my, your) használatát sajátíthatod el.",
            subsections: {
                explanation: {
                    title: "Magyarázat",
                    icon: "📚",
                    type: "explanation",
                    content: "Az angolban megkülönböztetjük a mondat alanyát kifejező névmásokat (pl. <strong>I, you, he</strong>) és a tárgyát kifejező tárgyas névmásokat (pl. <strong>me, you, him</strong>). A birtoklás kifejezésére birtokos mellékneveket használunk a főnevek előtt (pl. <strong>my phone, their dog</strong>)."
                },
                words: {
                    title: "Szavak",
                    icon: "📖",
                    type: "words",
                    dataSource: "data/A1/Lesson4_pronouns_adjectives/words.json"
                },
                fillBlanks: {
                    title: "Lyukas mondatok",
                    icon: "✏️",
                    type: "fill_blanks",
                    dataSource: "data/A1/Lesson4_pronouns_adjectives/fillBlanks.json"
                },
                wordOrder: {
                    title: "Szórendezés",
                    icon: "🔀",
                    type: "word_order",
                    dataSource: "data/A1/Lesson4_pronouns_adjectives/wordOrder.json"
                },
                trueFalse: {
                    title: "Igaz vagy Hamis",
                    icon: "✅",
                    type: "true_false",
                    dataSource: "data/A1/Lesson4_pronouns_adjectives/trueFalse.json"
                },
                sectionExam: {
                    title: "Fejezet vizsga",
                    icon: "🏆",
                    type: "section_exam",
                    dataSource: "data/A1/Lesson4_pronouns_adjectives/sectionExam.json"
                }
            }
        },
        Lesson5: {
            title: "Ötödik Lecke: Mutató Névmások (Demonstratives)",
            title_hu: "Ötödik Lecke: Mutató Névmások (Demonstratives)",
            title_en: "Lesson 5: Demonstratives",
            title_sk: "Piata lekcia: Ukazovacie zámená (Demonstratives)",
            explanation: "A mutató névmások (this, that, these, those) segítenek rámutatni a közelben vagy távolban elhelyezkedő dolgokra, tárgyakra és emberekre.",
            subsections: {
                explanation: {
                    title: "Magyarázat",
                    icon: "📚",
                    type: "explanation",
                    content: "A mutató névmások jelzik, hogy a tárgy vagy személy közel vagy távol van-e a beszélőhöz: <strong>this</strong> (ez - közel, egyes szám), <strong>that</strong> (az - távol, egyes szám), <strong>these</strong> (ezek - közel, többes szám) és <strong>those</strong> (azok - távol, többes szám)."
                },
                words: {
                    title: "Szavak",
                    icon: "📖",
                    type: "words",
                    dataSource: "data/A1/Lesson5_demonstratives/words.json"
                },
                fillBlanks: {
                    title: "Lyukas mondatok",
                    icon: "✏️",
                    type: "fill_blanks",
                    dataSource: "data/A1/Lesson5_demonstratives/fillBlanks.json"
                },
                wordOrder: {
                    title: "Szórendezés",
                    icon: "🔀",
                    type: "word_order",
                    dataSource: "data/A1/Lesson5_demonstratives/wordOrder.json"
                },
                trueFalse: {
                    title: "Igaz vagy Hamis",
                    icon: "✅",
                    type: "true_false",
                    dataSource: "data/A1/Lesson5_demonstratives/trueFalse.json"
                },
                sectionExam: {
                    title: "Fejezet vizsga",
                    icon: "🏆",
                    type: "section_exam",
                    dataSource: "data/A1/Lesson5_demonstratives/sectionExam.json"
                }
            }
        },
        Lesson6: {
            title: "Hatodik Lecke: Alapvető Segédigék (Basic Modals)",
            title_hu: "Hatodik Lecke: Alapvető Segédigék (Basic Modals)",
            title_en: "Lesson 6: Basic Modals",
            title_sk: "Šiesta lekcia: Základné modálne slovesá (Basic Modals)",
            explanation: "Ebben a leckében a legfontosabb módbeli segédigékkel ismerkedhetsz meg, elsősorban a képességet és lehetőséget kifejező \"can\" és \"can't\" használatával.",
            subsections: {
                explanation: {
                    title: "Magyarázat",
                    icon: "📚",
                    type: "explanation",
                    content: "A módbeli segédigék (modal verbs) a cselekvés módját fejezik ki. A <strong>can</strong> képességet (tud csinálni valamit) vagy lehetőséget (-hat, -het) fejez ki, míg tagadó alakja, a <strong>can't / cannot</strong> a képesség vagy engedély hiányát mutatja. A módbeli segédigék után az ige szótári alakja áll ragok nélkül."
                },
                words: {
                    title: "Szavak",
                    icon: "📖",
                    type: "words",
                    dataSource: "data/A1/Lesson6_Basic_Modals/words.json"
                },
                fillBlanks: {
                    title: "Lyukas mondatok",
                    icon: "✏️",
                    type: "fill_blanks",
                    dataSource: "data/A1/Lesson6_Basic_Modals/fillBlanks.json"
                },
                wordOrder: {
                    title: "Szórendezés",
                    icon: "🔀",
                    type: "word_order",
                    dataSource: "data/A1/Lesson6_Basic_Modals/wordOrder.json"
                },
                trueFalse: {
                    title: "Igaz vagy Hamis",
                    icon: "✅",
                    type: "true_false",
                    dataSource: "data/A1/Lesson6_Basic_Modals/trueFalse.json"
                },
                sectionExam: {
                    title: "Fejezet vizsga",
                    icon: "🏆",
                    type: "section_exam",
                    dataSource: "data/A1/Lesson6_Basic_Modals/sectionExam.json"
                }
            }
        }
    },
    A2: {
        ToBe: {
            title: "Első lecke: A \"Lenni\" Ige (The Verb \"TO BE\")",
            explanation: "Az A2 szinten a \"to be\" ige haladó használatát tanuljuk meg, beleértve a múlt idejű alakokat (was/were) és a tagadó formákat.",
            subsections: {
                explanation: {
                    title: "Magyarázat",
                    icon: "📚",
                    type: "explanation",
                    content: "Az A2 szinten a \"to be\" ige haladó használatát tanuljuk meg, beleértve a múlt idejű alakokat (<strong>was/were</strong>) és a tagadó formákat."
                },
                words: {
                    title: "Szavak",
                    icon: "📖",
                    type: "words",
                    items: []
                },
                fillBlanks: {
                    title: "Lyukas mondatok",
                    icon: "✏️",
                    type: "fill_blanks",
                    items: []
                },
                wordOrder: {
                    title: "Szórendezés",
                    icon: "🔀",
                    type: "word_order",
                    items: []
                },
                trueFalse: {
                    title: "Igaz vagy Hamis",
                    icon: "✅",
                    type: "true_false",
                    items: []
                },
                sectionExam: {
                    title: "Fejezet vizsga",
                    icon: "🏆",
                    type: "section_exam",
                    items: []
                }
            }
        }
    },
    B1: {
        ToBe: {
            title: "Első lecke: A \"Lenni\" Ige (The Verb \"TO BE\")",
            explanation: "Az A2 szinten a \"to be\" ige haladó használatát tanuljuk meg, beleértve a múlt idejű alakokat (was/were) és a tagadó formákat.",
            subsections: {
                explanation: {
                    title: "Magyarázat",
                    icon: "📚",
                    type: "explanation",
                    content: "Az A2 szinten a \"to be\" ige haladó használatát tanuljuk meg, beleértve a múlt idejű alakokat (<strong>was/were</strong>) és a tagadó formákat."
                },
                words: {
                    title: "Szavak",
                    icon: "📖",
                    type: "words",
                    items: []
                },
                fillBlanks: {
                    title: "Lyukas mondatok",
                    icon: "✏️",
                    type: "fill_blanks",
                    items: []
                },
                wordOrder: {
                    title: "Szórendezés",
                    icon: "🔀",
                    type: "word_order",
                    items: []
                },
                trueFalse: {
                    title: "Igaz vagy Hamis",
                    icon: "✅",
                    type: "true_false",
                    items: []
                },
                sectionExam: {
                    title: "Fejezet vizsga",
                    icon: "🏆",
                    type: "section_exam",
                    items: []
                }
            }
        }
    },
    B2: {
        ToBe: {
            title: "Első lecke: A \"Lenni\" Ige (The Verb \"TO BE\")",
            explanation: "Az A2 szinten a \"to be\" ige haladó használatát tanuljuk meg, beleértve a múlt idejű alakokat (was/were) és a tagadó formákat.",
            subsections: {
                explanation: {
                    title: "Magyarázat",
                    icon: "📚",
                    type: "explanation",
                    content: "Az A2 szinten a \"to be\" ige haladó használatát tanuljuk meg, beleértve a múlt idejű alakokat (<strong>was/were</strong>) és a tagadó formákat."
                },
                words: {
                    title: "Szavak",
                    icon: "📖",
                    type: "words",
                    items: []
                },
                fillBlanks: {
                    title: "Lyukas mondatok",
                    icon: "✏️",
                    type: "fill_blanks",
                    items: []
                },
                wordOrder: {
                    title: "Szórendezés",
                    icon: "🔀",
                    type: "word_order",
                    items: []
                },
                trueFalse: {
                    title: "Igaz vagy Hamis",
                    icon: "✅",
                    type: "true_false",
                    items: []
                },
                sectionExam: {
                    title: "Fejezet vizsga",
                    icon: "🏆",
                    type: "section_exam",
                    items: []
                }
            }
        }
    }
};
