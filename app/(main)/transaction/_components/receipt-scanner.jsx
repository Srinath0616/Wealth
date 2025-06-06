// "use client";

// import { scanReceipt } from "@/actions/transaction";
// import useFetch from "@/hooks/use-fetch";
// import { Button } from "@react-email/components";
// import { Camera, Loader, Loader2 } from "lucide-react";
// import React, { use, useRef } from "react";

// const ReciptScanner = (onScanComplete) => {
//   const fileInputRef = useRef();

//   const {
//     loading: scanReceiptLoading,
//     fn: scanReceiptFn,
//     data: scannedData,
//   } = useFetch(scanReceipt);

//   const handleReceiptScan = () => {};
//   return (
//     <div>
//       <input
//         type="file"
//         ref={fileInputRef}
//         className="hidden"
//         accept="image/*"
//         capture="environment"
//         onChange={(e) => {
//           const file = e.target.files?.[0];
//           if (file) {
//             handleReceiptScan(file);
//           }
//         }}
//       />
//       <Button className="w-full h-10 bg-gradient-to-br from-orange-500 via-pink-500 to-purple-500 animate-gradient hover:opacity-90 transistion-opacity text-white hover:text-white rounded-lg ">
//         {scanReceiptLoading ? (
//           <>
//             {" "}
//             <Loader2 className="mr-2 animate-spin" />
//             <span>Scanning Receipt...</span>
//           </>
//         ) : (
//           <>
//             <Camera className="mr-2" />
//             <span>Scan Receipt with AI</span>
//           </>
//         )}
//       </Button>
//     </div>
//   );
// };

// export default ReciptScanner;

"use client";

import { scanReceipt } from "@/actions/transaction";
import useFetch from "@/hooks/use-fetch";
import { Button } from "@/components/ui/button"; // shadcn/ui Button
import { Camera, Loader2 } from "lucide-react";
import React, { useEffect, useRef } from "react";
import { toast } from "sonner";

const ReceiptScanner = ({ onScanComplete }) => {
  const fileInputRef = useRef();

  const {
    loading: scanReceiptLoading,
    fn: scanReceiptFn,
    data: scannedData,
  } = useFetch(scanReceipt);

  const handleReceiptScan = async (file) => {
    if(file.size > 5 * 1024 * 1024) {
        toast.error("File size exceeds 5MB limit.");
        return;
    }
    await scanReceiptFn(file)
  };

  useEffect(()=>{
    if(scannedData && !scanReceiptLoading) {
        onScanComplete(scannedData);
        toast.success("Receipt scanned successfully!");
    }

  },[scanReceiptLoading,scannedData]);
  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleReceiptScan(file);
          }
        }}
      />
      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={scanReceiptLoading}
        type="button"
        variant="outline"
        className="w-full h-10 text-white rounded-lg flex items-center justify-center gap-2 animate-gradient bg-gradient-to-br from-orange-500 via-pink-500 to-purple-500 hover:opacity-90 transition-opacity"
      >
        {scanReceiptLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Scanning Receipt...</span>
          </>
        ) : (
          <>
            <Camera className="h-4 w-4" />
            <span>Scan Receipt with AI</span>
          </>
        )}
      </Button>
    </div>
  );
};

export default ReceiptScanner;
