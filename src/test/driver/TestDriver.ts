import { BrowserObject, remote } from 'webdriverio'
import Chromedriver from './Chromedriver'
import request from 'request'
import {
  MessageResponse,
  MessageHandlerResult,
  MessageToMain,
  MESSAGE_RESPONSES,
} from '../../messages'
import { ChildProcess } from 'child_process'

function isRunning(statusUrl: string, callback: Function) {
  const cb = false
  const requestOptions = {
    uri: statusUrl,
    json: true,
    followAllRedirects: true,
  }
  request(requestOptions, function(error, response, body) {
    if (error) return callback(cb)
    if (response.statusCode !== 200) return callback(cb)
    callback(body && body.value.ready)
  })
}

function waitForChromeDriver(
  driverProcess: ChildProcess,
  statusUrl: string,
  startTimeout: number
) {
  return new Promise<boolean>(function(resolve, reject) {
    const startTime = Date.now()
    const checkIfRunning = function() {
      isRunning(statusUrl, (running: any) => {
        if (!driverProcess) {
          return reject(Error('ChromeDriver has been stopped'))
        }

        if (running) {
          return resolve(true)
        }

        const elapsedTime = Date.now() - startTime
        if (elapsedTime > startTimeout) {
          return reject(
            Error('ChromeDriver did not start within ' + startTimeout + 'ms')
          )
        }

        global.setTimeout(checkIfRunning, 100)
      })
    }
    checkIfRunning()
  })
}
function waitForChromeDriverToStop(
  driverProcess: ChildProcess,
  statusUrl: string,
  stopTimeout: number
) {
  return new Promise<boolean>(function(resolve, reject) {
    const startTime = Date.now()
    const checkIfRunning = function() {
      isRunning(statusUrl, (running: any) => {
        if (!driverProcess) {
          return resolve(true)
        }

        const elapsedTime = Date.now() - startTime
        if (running && elapsedTime > stopTimeout) {
          return reject(
            Error('ChromeDriver did not start within ' + stopTimeout + 'ms')
          )
        } else {
          global.setTimeout(checkIfRunning, 100)
        }
      })
    }
    checkIfRunning()
  })
}

export async function createTestDriver({
  chromedriverPath: chromedriverPath,
  webdriverIoPath,
  appDir,
  chromeArgs: chromeArgs,
  env: givenEnv,
  logLevel = 'silent',
}: {
  chromedriverPath: string
  webdriverIoPath: string
  appDir: string
  chromeArgs: string[]
  env?: NodeJS.ProcessEnv
  logLevel?: string
}) {
  const hostname = '127.0.0.1'
  const port = 9515
  const urlBase = '/'

  const env = {
    NODE_ENV: 'test',
    REACT_APP_TEST_DRIVER: 'true',
    ELECTRON_START_URL: 'http://localhost:3000',
    // PATH: process.env.PATH,
    ...givenEnv,
  } as NodeJS.ProcessEnv

  // const {chromeDriverProcess: driverProcess, stop: stopChromeDriver }  = runChromeDriver([], env);
  const driver = new Chromedriver(
    chromedriverPath,
    [],
    env
    // ['--port=' + port, '--url-base=' + urlBase],
  )
  await waitForChromeDriver(
    driver.process,
    `http://${hostname}:${port}${urlBase}status`,
    7000
  )

  // await chromedriverLauncher

  const browser: BrowserObject = await remote({
    waitforTimeout: 30000,
    hostname, // Use localhost as chrome driver server
    port, // "9515" is the port opened by chrome driver.
    capabilities: {
      browserName: 'chrome',
      'goog:chromeOptions': {
        binary: webdriverIoPath,
        args: [...chromeArgs, 'app=' + appDir],
        windowTypes: ['app', 'webview'],
      },
    },
    logLevel: (logLevel || 'silent') as
      | 'silent'
      | 'trace'
      | 'debug'
      | 'info'
      | 'warn'
      | 'error'
      | undefined,
  })

  return new TestDriver({
    browser,
    driver,
  })
}

export class TestDriver {
  isReady: Promise<MessageResponse<boolean>>
  client: BrowserObject
  _driver: Chromedriver

  constructor({
    driver,
    browser,
  }: {
    driver: Chromedriver
    browser: BrowserObject
  }) {
    this.client = browser
    this._driver = driver

    // wait for ready
    this.isReady = this.sendToMainProcess({ type: 'isReady' }).catch(err => {
      console.error('Application failed to start', err)
      this.stop()
      process.exit(1)
    })
  }

  async sendToMainProcess<M extends MessageToMain>(
    message: M
  ): Promise<MessageResponse<MessageHandlerResult<M>>> {
    return this.client.executeAsync(async (message: MessageToMain, done) => {
      const { ipcRenderer } = require('electron')
      ipcRenderer.invoke('message', message).then(async result => {
        done(await result)
      })
    }, message)
  }

  async webContentsSend(channel: string, ...args: any[]) {
    // TODO: get rid of `any`
    await this.client.execute(
      (channel, ...args) => {
        console.log(`sending via ${channel}: ${args.join(', ')}`)
        const electron = require('electron')
        console.log('getting web contents')
        const webContents = electron.remote.getCurrentWebContents()
        console.log('sending...')
        webContents.send(channel, ...args)
        console.log('sent')
      },
      channel,
      ...args
    )
  }

  //   async sendToMainProcessSync(channel: string, ...args: any[]) { // TODO: get rid of `any`
  //   await this.client.execute((channel, ...args) => {
  //     const { ipcRenderer } = require("electron");
  //     ipcRenderer
  //       .send(channel, ...args)
  //   }, channel, ...args)
  // }

  async stop() {
    console.log('closing window')
    await this.client.closeWindow()
    // await browser.deleteSession();
    console.log('running?')
    const isRunningNow = () =>
      new Promise((res, rej) => {
        try {
          isRunning('http://localhost:9515/status', (running: any) => {
            if (running) res(true)
            else res(false)
          })
        } catch (err) {
          return res(false)
        }
      })
    console.log('running?', { isRunningNow: await isRunningNow() })
    if (await isRunningNow()) {
      console.log('trying to stop chromedriver process')
      const killed = this._stopChromeDriver()
      if (!killed) throw new Error('Could not kill chromedriver process')
    }
    console.log('done stopping app')
  }

  _stopChromeDriver() {
    return this._driver.stop()
  }

  async closeWindow() {
    await this.client.execute(() => {
      console.log('trying to close')
      return require('electron').ipcRenderer.invoke('close')
    }, [])
  }
}
