import { FC } from 'react';

type ExpertiseType = 'UI' | 'UX' | 'SEO' | 'Graphic';

interface Props {
  type: ExpertiseType;
}

export const ExpertiseSelectItem: FC<Props> = () => {
  return <div>ExpertiseSelectItem</div>;

  //   TODO: 預期是像下面註解的結構，一個 FormField 的元件，可參考下面這連結
  //   https://github.com/Xchange-Taiwan/XChange-Coffee-Chat/blob/ccc2af87507623959534eee2e530cdf0ed841557/src/components/onboarding/Steps/TopicsToDiscuss.tsx#L47-L96
  //
  //   return (
  //     <FormField
  //       key={option.value}
  //       control={form.control}
  //       name="talkTopic"
  //       render={({ field }) => {
  //         return (
  //           <FormItem
  //             key={option.value}
  //             className={cn(
  //               'flex items-start gap-2 rounded-xl border border-gray-200 px-4 py-3',
  //               field.value.includes(option.value) &&
  //                 'border-primary bg-secondary',
  //             )}
  //           >
  //             <FormLabel className="flex grow cursor-pointer gap-4 ">
  //               <div className="rounded-full bg-[#EBFBFB] p-3">
  //                 {
  //                   TALK_TOPIC_ICON_MAP[
  //                     option.value as keyof typeof TALK_TOPIC_ICON_MAP
  //                   ]
  //                 }
  //               </div>

  //               <div>
  //                 <p className="text-base font-normal text-text-primary">
  //                   {option.text}
  //                 </p>
  //                 <p className=" text-sm text-text-tertiary">文案待 PM 補上</p>
  //               </div>
  //             </FormLabel>
  //             <FormControl>
  //               <Checkbox
  //                 checked={field.value?.includes(option.value)}
  //                 onCheckedChange={(checked) => {
  //                   return checked
  //                     ? field.onChange([...field.value, option.value])
  //                     : field.onChange(
  //                         field.value?.filter((value) => value !== option.value),
  //                       );
  //                 }}
  //               />
  //             </FormControl>
  //           </FormItem>
  //         );
  //       }}
  //     />
  //   );
};
