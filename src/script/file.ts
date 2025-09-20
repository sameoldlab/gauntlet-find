const { os } = Deno.build
const OS_CMD: Record<string, { cmd: string, args: string[] }> = Object.freeze({
  darwin: { cmd: "file", args: ["--mime-type", "-b"] },
  linux: { cmd: "file", args: ["--mime-type", "-b"] },
  fallback: { cmd: "file", args: ["--mime-type", "-b"] },
})

/** Get MIME type using file command */
export function getMimeTypeSync(filePath: string): string {
  if (!Object.keys(OS_CMD).includes(os)) {
    console.error(`unsupported os: ${os}. trying default command`)
  }

  try {
    const output = new Deno.Command(OS_CMD[os].cmd ?? OS_CMD.fallback.args, {
      args: [...OS_CMD[os].args ?? OS_CMD.fallback.args, filePath],
      stdout: "piped",
    }).outputSync();
    if (output.code === 0) {
      return new TextDecoder().decode(output.stdout).trim();
    }
  } catch (e) {
    console.error(e)
  }
  return 'text/plain';
}

/** Get MIME type using file command */
export async function getMimeType(filePath: string): Promise<string> {
  if (!Object.keys(OS_CMD).includes(os)) {
    console.warn(`unsupported os: ${os}. trying default command`)
  }

  try {
    const output = await new Deno.Command(OS_CMD[os].cmd ?? OS_CMD.fallback.args, {
      args: [...OS_CMD[os].args ?? OS_CMD.fallback.args, filePath],
      stdout: "piped",
    }).output();
    if (output.code === 0) {
      return new TextDecoder().decode(output.stdout).trim();
    }
  } catch (e) {
    console.error(e)
  }
  return 'text/plain';
}

