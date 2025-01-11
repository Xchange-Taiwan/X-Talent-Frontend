import * as Dialog from '@radix-ui/react-dialog';
import { Control, useController } from 'react-hook-form';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { SignUpSchema } from '@/schemas/auth';

interface TermsOfServiceDialogProps {
  control: Control<z.infer<typeof SignUpSchema>>;
}

export default function TermsOfServiceDialog({
  control,
}: TermsOfServiceDialogProps) {
  const { field } = useController({
    name: 'hasReadTermsOfService',
    control,
  });

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <span className="text-blue-600 cursor-pointer text-sm underline">
          X-Talent 服務條款
        </span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="bg-white fixed left-1/2 top-1/2 z-50 flex h-[100vh] w-[95vw] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-background/100 p-4 shadow-lg focus:outline-none sm:h-[90vh] sm:max-w-xl sm:p-6 md:max-w-2xl md:p-8 lg:max-w-4xl lg:p-10">
          <Dialog.Close asChild>
            <button
              aria-label="Close"
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              ✕
            </button>
          </Dialog.Close>

          <Dialog.Title className="p-10 text-center text-3xl font-semibold text-gray-900">
            X-Talent 服務條款與隱私權政策
          </Dialog.Title>

          <div className="flex-grow overflow-y-auto px-2 sm:px-4 md:px-6 lg:px-8">
            <div className="text-sm leading-relaxed text-gray-600 sm:text-base">
              <h2 className="mt-4 text-2xl font-medium font-semibold text-gray-900">
                服務條款
              </h2>
              <p>
                歡迎使用X-talent（以下簡稱「本平台」）。請在使用本平台之前仔細閱讀以下使用條款。使用本平台即表示您同意遵守以下條款和條件。
              </p>

              <h3 className="mt-4 text-lg font-medium font-semibold text-gray-900">
                一、會員註冊
              </h3>
              <p>為了使用本平台的全部功能，使用者需同意以下事項：</p>
              <ul className="list-disc pl-5">
                <li>
                  請提供準確、完整和最新的註冊資訊。不得以第三人之名義進行註冊或使用本服務。
                </li>
                <li>
                  您必須保持您的註冊資料的即時更新，若使用者提供任何錯誤、不實或不完整的資料，本平台有權暫停或終止使用者帳號，並拒絕使用者使用全部或部分服務。
                </li>
                <li>
                  會員應妥善保管密碼，不可將密碼洩露或提供給他人知道或使用。
                </li>
              </ul>

              <h3 className="mt-4 text-lg font-medium font-semibold text-gray-900">
                二、使用者行為
              </h3>
              <ul className="list-disc pl-5">
                <li>
                  您承諾絕不從事任何非法、侵犯他人權益或破壞平台運作的行為
                </li>
                <li>
                  您同意在使用本平台時遵守中華民國相關法規及一切使用網際網路之國際慣例。會員若係中華民國以外之使用者，並同意遵守所屬國家或地域之法令。
                </li>
                <li>
                  您於使用本平台會員服務時應遵守以下限制：
                  <ol className="list-decimal pl-5">
                    <li>
                      有損他人人格或商標權、著作權等智慧財產權或其他權利內容。
                    </li>
                    <li>使用違反公共秩序或善良風俗或其他不法之文字。</li>
                    <li>強烈政治、宗教色彩的偏激言論。</li>
                    <li>其他違反本平台「服務條款」的內容。</li>
                  </ol>
                </li>
              </ul>

              <h3 className="mt-4 text-lg font-medium font-semibold text-gray-900">
                三、知識產權
              </h3>
              <p>
                本平台的所有內容，包括但不限於文字、圖片、標誌、圖像、影片和軟體，均受到相關的智慧財產權法律保護。未經授權，您不得以任何形式使用、修改、複製或散佈這些內容。
              </p>

              <h3 className="mt-4 text-lg font-medium font-semibold text-gray-900">
                四、隱私保護
              </h3>
              <p>
                我們將根據我們的隱私權政策處理您的個人資訊。請在使用本平台之前仔細閱讀並了解我們的隱私權政策。
              </p>

              <h3 className="mt-4 text-lg font-medium font-semibold text-gray-900">
                五、免責聲明
              </h3>
              <p>
                本平台僅為使用者提供交流和分享的平台，不對內容的準確性、可靠性或完整性提供任何明示或暗示的保證。使用本平台的風險由您自行承擔。
              </p>

              <h2 className="mt-8 text-2xl font-medium font-semibold text-gray-900">
                隱私權政策
              </h2>
              <p>
                為了讓您能夠安心的使用本平台的各項服務與資訊，特此向您說明本平台的隱私權保護政策，以保障您的權益，請您詳閱下列內容：
              </p>

              <h3 className="mt-4 text-lg font-medium font-semibold text-gray-900">
                一、隱私權保護政策的適用範圍
              </h3>
              <p>
                隱私權保護政策內容，包括本平台如何處理在您使用網站服務時收集到的個人識別資料。隱私權保護政策不適用於本平台以外的相關連結網站，也不適用於非本平台所委託或參與管理的人員。
              </p>

              <h3 className="mt-4 text-lg font-medium font-semibold text-gray-900">
                二、個人資料的蒐集、處理及利用方式
              </h3>
              <ul className="list-disc pl-5">
                <li>
                  當您造訪本平台或使用本平台所提供之功能服務時，我們將視該服務功能性質，請您提供必要的個人資料，並在該特定目的範圍內處理及利用您的個人資料；非經您書面同意，本網站不會將個人資料用於其他用途。
                </li>
                <li>
                  本網站在您使用服務信箱、問卷調查等互動性功能時，會保留您所提供的姓名、電子郵件地址、聯絡方式及使用時間等。
                </li>
                <li>
                  於一般瀏覽時，伺服器會自行記錄相關行徑，包括您使用連線設備的IP位址、使用時間、使用的瀏覽器、瀏覽及點選資料記錄等，做為我們增進網站服務的參考依據，此記錄為內部應用，決不對外公佈。
                </li>
                <li>
                  為提供精確的服務，我們會將收集的問卷調查內容進行統計與分析，分析結果之統計數據或說明文字呈現，除供內部研究外，我們會視需要公佈統計數據及說明文字，但不涉及特定個人之資料。
                </li>
              </ul>

              <h3 className="mt-4 text-lg font-medium font-semibold text-gray-900">
                三、資料之保護
              </h3>
              <ul className="list-disc pl-5">
                <li>
                  本網站主機均設有防火牆、防毒系統等相關的各項資訊安全設備及必要的安全防護措施，加以保護網站及您的個人資料採用嚴格的保護措施，只由經過授權的人員才能接觸您的個人資料，相關處理人員皆簽有保密合約，如有違反保密義務者，將會受到相關的法律處分。
                </li>
                <li>
                  如因業務需要有必要委託其他單位提供服務時，本平台亦會嚴格要求其遵守保密義務，並且採取必要檢查程序以確定其將確實遵守。
                </li>
              </ul>

              <h3 className="mt-4 text-lg font-medium font-semibold text-gray-900">
                四、網站對外的相關連結
              </h3>
              <p>
                本平台的網頁提供其他網站的網路連結，您也可經由本網站所提供的連結，點選進入其他網站。但該連結網站不適用本網站的隱私權保護政策，您必須參考該連結網站中的隱私權保護政策。
              </p>

              <h3 className="mt-4 text-lg font-medium font-semibold text-gray-900">
                五、與第三人共用個人資料之政策
              </h3>
              <p>
                本網站絕不會提供、交換、出租或出售任何您的個人資料給其他個人、團體、私人企業或公務機關，但有法律依據或合約義務者，不在此限。
              </p>
              <p>前項但書之情形包括不限於：</p>
              <ul className="list-disc pl-5">
                <li>經由您書面同意。</li>
                <li>法律明文規定。</li>
                <li>為免除您生命、身體、自由或財產上之危險。</li>
                <li>
                  與公務機關或學術研究機構合作，基於公共利益為統計或學術研究而有必要，且資料經過提供者處理或蒐集著依其揭露方式無從識別特定之當事人。
                </li>
                <li>
                  當您在網站的行為，違反服務條款或可能損害或妨礙網站與其他使用者權益或導致任何人遭受損害時，經網站管理單位研析揭露您的個人資料是為了辨識、聯絡或採取法律行動所必要者。
                </li>
                <li>有利於您的權益。</li>
                <li>
                  本網站委託廠商協助蒐集、處理或利用您的個人資料時，將對委外廠商或個人善盡監督管理之責。
                </li>
              </ul>

              <h3 className="mt-4 text-lg font-medium font-semibold text-gray-900">
                六、Cookie之使用
              </h3>
              <p>
                為了提供您最佳的服務，本平台會在您的電腦中放置並取用我們的
                Cookie，若您不願接受 Cookie
                的寫入，您可在您使用的瀏覽器功能項中設定隱私權等級為高，即可拒絕
                Cookie 的寫入，但可能會導致網站某些功能無法正常執行。
              </p>

              <h3 className="mt-4 text-lg font-medium font-semibold text-gray-900">
                七、隱私權保護政策之修正
              </h3>
              <p>
                本網站隱私權保護政策將因應需求隨時進行修正，修正後的條款將刊登於網站上。
              </p>

              <h3 className="mt-4 text-lg font-medium font-semibold text-gray-900">
                八、使用個人資訊的目的
              </h3>
              <p>
                我們使用您的個人資訊來提供、維護和改善本平台的服務。您的資訊可能用於以下用途：
              </p>
              <ul className="list-disc pl-5">
                <li>註冊和管理帳戶</li>
                <li>與您聯繫和回應您的查詢</li>
                <li>提供個人化的使用體驗</li>
                <li>分析和改善平台的功能和性能</li>
                <li>向您發送相關的通知和更新</li>
              </ul>
            </div>
          </div>
          <div className="mt-6 flex justify-center">
            <Dialog.Close asChild>
              <Button onClick={() => field.onChange(true)}>同意</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
