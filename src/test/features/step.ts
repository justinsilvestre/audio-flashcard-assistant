import { stdout } from 'process'
import { TestSetup } from '../setUpDriver'

type TestStep = {
  description: string
  runTest: (setup: TestSetup) => Promise<any>
}

export const step = (
  description: string,
  runTest: (setup: TestSetup) => Promise<any>
): TestStep => ({ description, runTest })

export const runAll = (testSteps: TestStep[], getSetup: () => TestSetup) => {
  testSteps.forEach(({ description, runTest }) => {
    test(description, async () => {
      const setup = getSetup()
      stdout.write('\n\n ' + description + '\n' + '='.repeat(30) + '\n')
      try {
        await runTest(setup)
      } catch (err) {
        try {
          if (process.env.SPECTRON_LOG_FAILURES) {
            console.log('Logging markup from failed test:')
            const source = await setup.client._driver.client.getPageSource()
            console.log(source)

            console.log('Logging persisted data from failed test:')
            await setup.logPersistedData()
          }
        } catch (err) {
          console.error(`Could not log info for failed test: ${err}`)
        }

        throw err
      }
    })
  })
}
