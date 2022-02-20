import * as cli from '@actions/exec'
import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'

const scalaCLIVersion = '0.1.2'

async function execOutput(cmd: string, ...args: string[]): Promise<string> {
  let output = ''
  const options = {
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString()
      }
    }
  }
  await cli.exec(cmd, args.filter(Boolean), options)
  return output.trim()
}

async function downloadScalaCli(): Promise<string> {
  const baseUrl = `https://github.com/VirtusLab/scala-cli/releases/download/v${scalaCLIVersion}/scala-cli-x86_64`
  let scalaCliBinary = ''
  switch (process.platform) {
    case 'linux': {
      const guid = await tc.downloadTool(`${baseUrl}-pc-linux.gz`)
      const arc = `${guid}.gz`
      await cli.exec('mv', [guid, arc])
      scalaCliBinary = arc
      break
    }
    case 'darwin': {
      const guid = await tc.downloadTool(`${baseUrl}-apple-darwin.gz`)
      const arc = `${guid}.gz`
      await cli.exec('mv', [guid, arc])
      scalaCliBinary = arc
      break
    }
    case 'win32': {
      const guid = await tc.downloadTool(`${baseUrl}-pc-win32.zip`)
      const arc = `${guid}.zip`
      await cli.exec('mv', [guid, arc])
      scalaCliBinary = arc
      core.info(scalaCliBinary)
      break
    }
    default:
      core.setFailed(`Unknown process.platform: ${process.platform}`)
  }
  if (!scalaCliBinary) core.setFailed(`Couldn't download ScalaCLI`)
  if (scalaCliBinary.endsWith('.gz')) {
    await cli.exec('gzip', ['-d', scalaCliBinary])
    scalaCliBinary = scalaCliBinary.slice(
      0,
      scalaCliBinary.length - '.gz'.length
    )
  }
  if (scalaCliBinary.endsWith('.zip')) {
    const destDir = scalaCliBinary.slice(0, scalaCliBinary.length - '.zip'.length)
    await cli.exec('unzip', ['-j', scalaCliBinary, 'scala-cli.exe', '-d', destDir])
    scalaCliBinary = `${destDir}\\scala-cli.exe`
  }
  await cli.exec('chmod', ['+x', scalaCliBinary])
  return scalaCliBinary
}

async function scalaCLI(args: string[]): Promise<string> {
  const previous = tc.find('scala-cli', scalaCLIVersion)
  if (previous) {
    core.addPath(previous)
  } else {
    const scalaCLIBinary = await downloadScalaCli()
    const binaryName =
      process.platform === 'win32' ? 'scala-cli.exe' : 'scala-cli'
    const scalaCLICached = await tc.cacheFile(
      scalaCLIBinary,
      binaryName,
      'scala-cli',
      scalaCLIVersion
    )
    core.addPath(scalaCLICached)
  }
  return execOutput('scala-cli', ...args)
}

async function run(): Promise<void> {
  try {
    await core.group('Install ScalaCLI', async () => {
      await scalaCLI(['--help'])
      core.setOutput('scala-cli-version', scalaCLIVersion)
    })
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
