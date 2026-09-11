/**
 * Fige l'entrypoint ESM, le manifest et les formes API 2.x des définitions
 * (presets, feedbacks, variables) sans lancer Companion.
 */

import nodeTest from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { InstanceBase, combineRgb } from '@companion-module/base'
import initActions from '../actions.js'
import initFeedbacks from '../feedbacks.js'
import initPresets from '../presets.js'
import initVariables from '../variables.js'

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Lit un fichier JSON du module.
 */
function readJson (relativePath) {
  return JSON.parse(fs.readFileSync(path.join(appDir, relativePath), 'utf8'))
}

/**
 * Couleurs identiques à celles définies dans main.js.
 */
const colors = {
  white: combineRgb(255, 255, 255),
  black: combineRgb(0, 0, 0),
  green: combineRgb(0, 200, 0),
  red: combineRgb(200, 0, 0)
}

/**
 * Lie actions.js à un contexte factice et capture les définitions.
 */
function captureActions () {
  const defs = {}
  initActions.call({ setActionDefinitions (d) { Object.assign(defs, d) } })
  return defs
}

/**
 * Lie feedbacks.js à un contexte factice et capture les définitions.
 */
async function captureFeedbacks () {
  const defs = {}
  await initFeedbacks.call({ colors, setFeedbackDefinitions (d) { Object.assign(defs, d) } })
  return defs
}

/**
 * Lie presets.js à un contexte factice et capture structure + presets.
 */
function capturePresets () {
  const calls = []
  initPresets.call({ colors, setPresetDefinitions (...args) { calls.push(args) } })
  return calls
}

/**
 * Lie variables.js à un contexte factice et capture l'argument transmis.
 */
async function captureVariables () {
  let received
  await initVariables.call({ setVariableDefinitions (d) { received = d } })
  return received
}

nodeTest.describe('entrypoint ESM main.js', () => {
  nodeTest('exporte la classe module par défaut et UpgradeScripts', async () => {
    const mod = await import('../main.js')
    assert.equal(typeof mod.default, 'function')
    assert.ok(mod.default.prototype instanceof InstanceBase)
    assert.ok(Array.isArray(mod.UpgradeScripts))
  })
})

nodeTest.describe('manifest companion/manifest.json', () => {
  const manifest = readJson('companion/manifest.json')

  nodeTest('déclare une connexion API 2.x sur node22', () => {
    assert.equal(manifest.type, 'connection')
    assert.equal(manifest.runtime.type, 'node22')
    assert.equal(manifest.runtime.api, 'nodejs-ipc')
    assert.ok(fs.existsSync(path.join(appDir, 'companion', manifest.runtime.entrypoint)))
  })

  nodeTest('aligne apiVersion et version sur les package.json', () => {
    const base = readJson('node_modules/@companion-module/base/package.json')
    const pkg = readJson('package.json')
    assert.equal(manifest.runtime.apiVersion, base.version)
    assert.equal(manifest.version, pkg.version)
  })
})

nodeTest.describe('presets.js (API 2.x)', () => {
  nodeTest('appelle setPresetDefinitions(structure, presets) avec 64 presets simples', async () => {
    const calls = capturePresets()
    assert.equal(calls.length, 1)
    assert.equal(calls[0].length, 2)
    const [structure, presets] = calls[0]

    const expectedIds = []
    for (let i = 1; i <= 32; i++) expectedIds.push(`impulse${i}`)
    for (let i = 1; i <= 32; i++) expectedIds.push(`towStates${i}`)
    assert.deepEqual(Object.keys(presets).sort(), expectedIds.sort())

    const actionIds = Object.keys(captureActions())
    const feedbackIds = Object.keys(await captureFeedbacks())
    for (const [id, preset] of Object.entries(presets)) {
      assert.equal(preset.type, 'simple', `${id} : type`)
      for (const step of preset.steps) {
        for (const entry of [...step.down, ...step.up]) {
          assert.ok(actionIds.includes(entry.actionId), `${id} : actionId ${entry.actionId}`)
          assert.equal(typeof entry.options, 'object', `${id} : options de ${entry.actionId}`)
          assert.notEqual(entry.options, null)
        }
      }
      for (const fb of preset.feedbacks) {
        assert.ok(feedbackIds.includes(fb.feedbackId), `${id} : feedbackId ${fb.feedbackId}`)
      }
    }

    assert.ok(Array.isArray(structure))
    assert.ok(structure.length >= 1)
    const referenced = structure[0].definitions
    assert.ok(Array.isArray(referenced))
    assert.deepEqual([...referenced].sort(), Object.keys(presets).sort())
  })
})

nodeTest.describe('feedbacks.js (API 2.x)', () => {
  nodeTest('32 feedbacks advanced avec affectedProperties et couleurs', async () => {
    const defs = await captureFeedbacks()
    const expected = []
    for (let i = 1; i <= 32; i++) expected.push(`gpio_state_bit_${i}`)
    assert.deepEqual(Object.keys(defs).sort(), expected.sort())
    for (const [id, def] of Object.entries(defs)) {
      assert.equal(def.type, 'advanced', `${id} : type`)
      assert.ok(def.affectedProperties.includes('bgcolor'), `${id} : affectedProperties`)
      const optionIds = def.options.map((o) => o.id)
      assert.ok(optionIds.includes('colorOff'), `${id} : colorOff`)
      assert.ok(optionIds.includes('colorOn'), `${id} : colorOn`)
    }
  })
})

nodeTest.describe('variables.js (API 2.x)', () => {
  nodeTest('transmet un objet de 33 variables nommées', async () => {
    const defs = await captureVariables()
    assert.equal(typeof defs, 'object')
    assert.ok(!Array.isArray(defs))
    const expected = ['Full']
    for (let i = 1; i <= 32; i++) expected.push(String(i).padStart(2, '0'))
    assert.deepEqual(Object.keys(defs).sort(), expected.sort())
    for (const [id, def] of Object.entries(defs)) {
      assert.equal(typeof def.name, 'string', `${id} : name`)
    }
  })
})
