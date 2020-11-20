/**
 * Utility functions for macros
 */
function MacrosPF1 () {}


/**
 * Returns the selected actors on scene that the player owns
 * If none selected, returns all the actors that player owns
 */
MacrosPF1.getActors = function () {
  const tokens = canvas.tokens.controlled;
  let actors = tokens.map(o => o.actor);
  if (!actors.length) actors = game.actors.entities.filter(o => o.hasPerm(game.user, "OWNER"));
  actors = actors.filter(o => o.hasPerm(game.user, "OWNER"));
  return actors
}

/**
 * Checks that required modules are available
 */
MacrosPF1.hasModule = function (moduleName) {
  return game.modules.has(moduleName) && game.modules.get(moduleName).active
}

/**
 * Checks that required modules are available
 */
MacrosPF1.applyBuff = function (command) {
  window.macroChain = [command]
  const macro = game.macros.find(o => o.name == "effet");
  if( !macro ) {
    return ui.notifications.warn("La macro <i>effet</i> n'a pas été importée ou vous ne disposez pas des permissions pour l'exécuter.");
  }
  macro.execute();
}

/**
 * Checks that required modules are available
 */
MacrosPF1.macroExec = function (macroName) {
  const pack = game.packs.get("pf1-fr.macrosfr");
  pack.getIndex().then( () => {
    console.log(macroName)
    const macro = pack.index.find(e => e.name === macroName);
    if( macro ) {
      console.log(macro._id)
      pack.getEntity(macro._id).then( m => m.execute() );
    }
  })
}

/************************************************
 * Dialog for skill check
 ************************************************/

class MacrosPF1SkillCheckDialog extends FormApplication {
  
  constructor(object, options) {
    super(object, options);
    
    if(options) {
      this.skill = options.skillId
      this.subskill = options.subSkillId
      this.checks = options.checks
      this.actor = game.actors.find( a => a._id == options.actorId )
      this.rollMode = options.rollMode
    }
  }
  
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "skillcheck",
      title: "Test de compétence",
      template: "modules/pf1-fr/templates/skillcheck-dialog.html",
      width: 650,
      height: "auto",
      closeOnSubmit: false,
      submitOnClose: false,
    });
  }
  
  async getData() {
    let data = {}
    data.actor = this.actor
    // sélectionner le bon bonus basé sur la spécialité
    if( this.subskill ) {
      data.skillbonus = this.actor.data.data.skills[this.skill].subSkills[this.subskill].mod
      data.subSkillName = this.actor.data.data.skills[this.skill].subSkills[this.subskill].name
    } else {
      data.skillbonus = this.actor.data.data.skills[this.skill].mod
    }
    
    data.checks = this.checks
    
    const pack = game.packs.get("pf1-fr.skillsfr");
    await pack.getIndex()
    
    const skillName = game.i18n.localize("PF1.Skill" + this.skill.charAt(0).toUpperCase() + this.skill.slice(1))
    let skillIdx = pack.index.find(e => e.name.toLowerCase() === skillName.toLowerCase());
    if( skillIdx ) {
      data.skillRef = TextEditor.enrichHTML(`@Compendium[pf1-fr.skillsfr.${skillIdx._id}]{${skillIdx.name}}`)
    }
    return data
  }

  activateListeners(html) {
    //super.activateListeners(html);
    html.find('.check').click(event => this._onTest(event));
  }
  
  async _onTest(event) {
    event.preventDefault();
    const idx = event.currentTarget.closest(".check").dataset.idx;
    if( idx >= 0 && idx < this.checks.length ) {
      const check = this.checks[idx]
      // changer le template de traduction et le mode de lancer par défaut
      const oldTransl = game.i18n.translations.PF1.SkillCheck
      const oldRollMode = this.rollMode && game.settings.get("core", "rollMode") != this.rollMode ? game.settings.get("core", "rollMode") : null
      if( oldRollMode ) {
        await game.settings.set("core", "rollMode", this.rollMode)
      }
      game.i18n.translations.PF1.SkillCheck = `{0} - ${check.name} - DD : ${check.dd}`
      // sélectionner la bonne spécialité
      if( this.subskill ) {
        this.actor.rollSkill(`${this.skill}.subSkills.${this.subskill}`, {event: event, skipDialog: true});
      } else {
        this.actor.rollSkill(this.skill, {event: event, skipDialog: true});
      }
      game.i18n.translations.PF1.SkillCheck = oldTransl
      if( oldRollMode ) {
        await game.settings.set("core", "rollMode", oldRollMode)
      }
    }
    this.close()
  }  
  
}

/************************************************
 * Dialog for selecting skill to check
 ************************************************/

class MacrosPF1SkillChecksDialog extends FormApplication {
  
  static skillSpecialty = null
  static rollMode = null
  
  constructor(object, options) {
    super(object, options);
    
    this.rollMode = null
    
    if(options) {
      this.rollMode = options.rollMode
    }
  }
  
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "skillchecks",
      title: "Test de compétence",
      template: "modules/pf1-fr/templates/skillchecks-dialog.html",
      width: 720,
      height: 685,
      closeOnSubmit: false,
      submitOnClose: false,
    });
  }
  
  async getData() {
    let data = {}
    data.checks = []
    data.checksknow = []
    data.checksspec = []
    const pack = game.packs.get("pf1-fr.macrosfr");
    await pack.getIndex()
    let promises = []
    
    const actors = MacrosPF1.getActors()
    const actor = actors.length > 0 ? actors[0] : null
    
    for( let i = 0; i < pack.index.length; i++ ) {
      if( pack.index[i].name.startsWith("Test : ") ) {
        const macro = await pack.getEntry(pack.index[i]._id)
        const abbr = pack.index[i].name.slice(7)
        const skill = Object.keys(CONFIG.PF1.skills).find(key => abbr.toLowerCase().startsWith(CONFIG.PF1.skills[key].toLowerCase()))
        const bonus = skill && actor ? actor.data.data.skills[skill].mod : 0
        
        if( abbr.startsWith("Connaissance") ) {
          var regExp = /\(([^)]+)\)/;
          var matches = regExp.exec(abbr);
          data.checksknow.push( { name: pack.index[i].name, abbr: matches[1], icon: macro.img, bonus: bonus } )
        } else if( abbr.endsWith("*") ) {
          if( skill && actor ) {
            let hasSubSkill = false
            Object.keys(actor.data.data.skills[skill].subSkills).forEach( sk => {
              const subskill = actor.data.data.skills[skill].subSkills[sk]
              data.checksspec.push( { name: pack.index[i].name, abbr: `${abbr.slice(0, -1)} : ${subskill.name}`, icon: macro.img, bonus: subskill.mod, specialty: sk } )
              hasSubSkill = true
            });
            if( !hasSubSkill ) {
              data.checksspec.push( { name: pack.index[i].name, abbr: `Aucune spécialité en ${abbr.slice(0, -1)}`, icon: macro.img, bonus: bonus } )
            }
          }
          
        } else {
          data.checks.push( { name: pack.index[i].name, abbr: abbr, icon: macro.img, bonus: bonus } )
        }
      }
    }
    return data
  }

  activateListeners(html) {
    //super.activateListeners(html);
    html.find('.check').click(event => this._onTest(event));
  }
  
  async _onTest(event) {
    event.preventDefault();
    const name = event.currentTarget.closest(".check").dataset.name;
    const specialty = event.currentTarget.closest(".check").dataset.specialty;
    this.close()
    if( name ) {
      // keep choice in storage
      if (typeof(Storage) !== "undefined") {
        localStorage.skillSpecialty = specialty
        localStorage.rollMode = this.rollMode
      } else {
        MacrosPF1SkillChecksDialog.skillSpecialty = specialty
        MacrosPF1SkillChecksDialog.rollMode = this.rollMode
      }
      
      MacrosPF1.macroExec(name)
    }
  }  

}


/************************************************
 * Utility for extract values from text (NPC)
 ************************************************/

MacrosPF1.extractCharacter = function (text) {
  text = text.trim()
  
  // remove carriage returns
  let line = text.replace(/(?:\r\n|\r|\n)/g, " ")

  let data = {}
  data.src = text
  
  // assuming first line is name
  data.name = text.split('\n')[0].trim()
  
  // abilities
  let res = Array.from(line.matchAll(/For ([+-]?\d+).*?, Dex ([+-]?\d+).*?, Con ([+-]?\d+).*?, Int ([+-]?\d+).*?, Sag ([+-]?\d+).*?, Cha ([+-]?\d+)/g))
  if( res.length > 0 ) {
    res = res[0]
    data.abilities = {}
    data.abilities.str = Number(res[1])
    data.abilities.dex = Number(res[2])
    data.abilities.con = Number(res[3])
    data.abilities.int = Number(res[4])
    data.abilities.wis = Number(res[5])
    data.abilities.cha = Number(res[6])
  }
  // hit points
  res = Array.from(line.matchAll(/pv (\d+) \( ?(\d+?)d/g))
  if( res.length > 0 ) {
    res = res[0]
    data.hp = {}
    data.hp.hitpoints = Number(res[1])
    data.hp.level = Number(res[2])
  }
  // saving throws
  res = Array.from(line.matchAll(/Réf ([+-]?\d+).*?, Vig ([+-]?\d+).*?, Vol ([+-]?\d+)/g))
  if( res.length > 0 ) {
    res = res[0]
    data.savingThrows = {}
    data.savingThrows.ref = Number(res[1])
    data.savingThrows.fort = Number(res[2])
    data.savingThrows.will = Number(res[3])
  }
  // armor class
  res = Array.from(line.matchAll(/CA (\d+), contact (\d+).*?\((.+?)\)/g))
  if( res.length > 0 ) {
    res = res[0]
    data.ac = {}
    data.ac.value = Number(res[1])
    data.ac.contact = Number(res[2])
    data.ac.notes= res[3]
  }
  // initiative
  res = Array.from(line.matchAll(/Init ([-+]\d+?)/g))
  if( res.length > 0 ) {
    res = res[0]
    data.init = {}
    data.init.value = Number(res[1])
  }
  // attack bonuses
  res = Array.from(line.matchAll(/BBA ([+-]?\d+).*?, BMO ([+-]?\d+).*?, DMD ([+-]?\d+)/g))
  if( res.length > 0 ) {
    res = res[0]
    data.attBonus = {}
    data.attBonus.bba = Number(res[1])
    data.attBonus.bmo = Number(res[2])
    data.attBonus.dmd = Number(res[3])
  }
  // attacks
  res = Array.from(text.matchAll(/^Corps à corps (.*)/gm))
  if( res.length > 0 ) {
    res = res[0]
    data.mattack = res[1]
  }
  res = Array.from(text.matchAll(/^À? ?[Dd]istance (.*)/gm))
  if( res.length > 0 ) {
    res = res[0]
    data.rattack = res[1]
  }
  res = Array.from(text.matchAll(/^Compétences (.*)/gm))
  if( res.length > 0 ) {
    data.skills = {}
    res = res[0]
    skills = res[1]
    Object.keys(CONFIG.PF1.skills).forEach( s => {
      let skillname
      if( s == "umd" ) { skillname = game.i18n.localize("PF1.SkillUMD") }
      else if( s.startsWith("k") ) {
        skillname = game.i18n.localize("PF1.Skill" + s.slice(0,2).toUpperCase() + s.charAt(2))
      } else {
        skillname = game.i18n.localize("PF1.Skill" + s.charAt(0).toUpperCase() + s.slice(1))
      }
      
      res = Array.from(skills.matchAll(new RegExp(skillname + " +([-+]?\\d+)", "g")))
      if( res.length > 0 ) {
        data.skills[s] = { value : Number(res[0][1]), name : skillname }
      }
    });
  }
  return data

}


/************************************************
 * Utility for importing a character based on extracted text
 ************************************************/

MacrosPF1.importCharacter = async function (data) {
  let c =
  {
    name: data.name && data.name.length > 0 ? data.name : "Imported",
    type: "npc",
    data: {
      details: { notes: { value: `<p>${ data.src.replace(/(?:\r\n|\r|\n)/g, "<br/>") }</p>` } },
      abilities: {
        str: { value: 10 },
        dex: { value: 10 },
        con: { value: 10 },
        int: { value: 10 },
        wis: { value: 10 },
        cha: { value: 10 }
      },
      attributes: {
        hpAbility: "",  // avoid having to compute the impact of constitution on total HP
        acNotes: data.ac ? data.ac.notes : "",
        naturalAC: data.ac ? data.ac.value - data.ac.contact : 0,
      },
    }
  }
  
  let modDex = 0;
  let modCon = 0;
  let modWis = 0;
  
  if( data.abilities ) {
    c.data.abilities.str.value = data.abilities.str
    c.data.abilities.dex.value = data.abilities.dex
    c.data.abilities.con.value = data.abilities.con
    c.data.abilities.int.value = data.abilities.int
    c.data.abilities.wis.value = data.abilities.wis
    c.data.abilities.cha.value = data.abilities.cha
    modStr = Math.floor((data.abilities.str-10)/2)
    modDex = Math.floor((data.abilities.dex-10)/2)
    modCon = Math.floor((data.abilities.con-10)/2)
    modWis = Math.floor((data.abilities.wis-10)/2)
  }
    
  items = []
  
  items.push({
    name: "Auto",
    type: "buff",
    data: {
      description: { "value": "Autogenerated by pf1-fr." },
      changes: [
        {
          "_id": "5l6m1em3",
          "formula": data.init ? (data.init.value - modDex).toString() : "0",
          "operator": "add",
          "target": "misc",
          "subTarget": "init",
          "modifier": "racial",
        },
        {
          "_id": "lw2mmzhh",
          "formula": data.hp ? data.hp.hitpoints.toString() : "0",
          "operator": "add",
          "target": "misc",
          "subTarget": "mhp",
          "modifier": "racial",
        },
        {
          "_id": "zvx5bjlj",
          "formula": data.savingThrows ? (data.savingThrows.fort - modCon).toString() : "0",
          "operator": "add",
          "target": "savingThrows",
          "subTarget": "fort",
          "modifier": "racial",
        },
        {
          "_id": "77lqsb3q",
          "formula": data.savingThrows ? (data.savingThrows.ref - modDex).toString() : "0",
          "operator": "add",
          "target": "savingThrows",
          "subTarget": "ref",
          "modifier": "racial",
        },
        {
          "_id": "3znmfsmh",
          "formula": data.savingThrows ? (data.savingThrows.will - modWis).toString() : "0",
          "operator": "add",
          "target": "savingThrows",
          "subTarget": "will",
          "modifier": "racial",
        },
        {
          "_id": "r4vCnt93",
          "formula": data.ac ? (data.ac.contact - modDex - 10).toString() : "0",
          "operator": "add",
          "target": "ac",
          "subTarget": "ac",
          "modifier": "racial",
        },
        {
          "_id": "1b2ddaav",
          "formula": data.attBonus ? (data.attBonus.bmo - modStr).toString() : "0",
          "operator": "add",
          "target": "misc",
          "subTarget": "cmb",
          "modifier": "racial",
        },
        {
          "_id": "tuc1br8h",
          "formula": data.attBonus ? (data.attBonus.dmd - modDex - modStr - 10).toString() : "0",
          "operator": "add",
          "target": "misc",
          "subTarget": "cmd",
          "modifier": "racial",
        },
      ],
      buffType: "perm",
      active: true,
      hideFromToken: true
    }
  })
  
  if( data.mattack ) {
    Array.prototype.push.apply(items, Importer.parseAttacks( data.mattack, true ))
  }
  if( data.rattack ) {
    Array.prototype.push.apply(items, Importer.parseAttacks( data.rattack, false ))
  }
  
  renderTemplate("modules/pf1-fr/templates/import-results.html", data).then(dlg => {
    new Dialog({
      title: "Résultats de l'import",
      content: dlg,
      buttons: {},
    }, { width: 600 }).render(true);
  })
    
  let actor = await Actor.create(c);
  await actor.createEmbeddedEntity("OwnedItem", items)
  await actor.update({})
  ui.sidebar.activateTab("actors");

  // update skills  
  if( data.skills ) {
    update = {}
    Object.keys(data.skills).forEach( s => {
      const curVal = actor.data.data.skills[s].mod
      let desiredVal = data.skills[s].value
      update[s] = { rank: Number(desiredVal-curVal) }
    })
    actor.update( { data: { skills: update } } )
  }

}



