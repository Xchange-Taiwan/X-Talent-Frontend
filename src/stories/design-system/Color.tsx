// eslint-disable-next-line @typescript-eslint/no-var-requires
const colors = require('../../design/tokens/color');

import { cn } from '../../lib/utils';

/**
 * Generate token list for Storybook display
 */
const colorTokenList = Object.keys(colors).map((tokenKey) => {
  const tokenList =
    typeof colors[tokenKey] === 'string'
      ? [
          {
            name: tokenKey,
            color: colors[tokenKey],
          },
        ]
      : Object.keys(colors[tokenKey]).map((token) => ({
          name: token,
          color: colors[tokenKey][token],
        }));

  return {
    title: tokenKey,
    tokenList,
  };
});

const TEXT_WHITE_LIST = ['dark', 'primary', 'secondary'];

export const Color = () => {
  return (
    <div className="h-full min-h-screen w-full py-12">
      <div className="container mx-auto">
        <h1 className="text-3xl font-extrabold">Color</h1>

        <hr className="my-8" />

        {colorTokenList.map(({ title, tokenList }) => {
          return (
            <div key={title} className="mb-8">
              <p className="mb-2 text-2xl font-bold">{title}</p>
              <div className="flex flex-wrap gap-6">
                {tokenList.map(({ name, color }) => (
                  <div
                    key={name}
                    className={cn(
                      'h-24 w-24 rounded-md border',
                      'm-2 flex flex-col justify-between gap-2 p-3',
                      +name > 400 || TEXT_WHITE_LIST.includes(name)
                        ? 'text-light'
                        : 'text-dark',
                    )}
                    style={{ backgroundColor: color }}
                  >
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="text-xs">{color}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
