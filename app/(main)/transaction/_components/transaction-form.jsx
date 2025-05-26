// "use client";

// import { createTransaction } from "@/actions/transaction";
// import { transactionSchema } from "@/app/lib/schema";
// import CreateAccountDrawer from "@/components/create-account-drawer";
// import { Input } from "@/components/ui/input";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import useFetch from "@/hooks/use-fetch";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { Button } from "@react-email/components";
// import { parse } from "date-fns";
// import { err } from "inngest/types";
// import React from "react";
// import { get, useForm } from "react-hook-form";

// const AddTransactionForm = ({ accounts, categories }) => {
//   const {
//     register,
//     setValue,
//     handleSubmit,
//     formState: { errors },
//     watch,
//     getValues,
//     reset,
//   } = useForm({
//     resolver: zodResolver(transactionSchema),
//     defaultValues: {
//       type: "EXPENSE",
//       amount: "",
//       description: "",
//       date: new Date(),
//       accountId: accounts.find((ac) => ac.isDefault)?.id,
//       isRecurring: false,
//     },
//   });

//   const {
//     loading: transactionLoading,
//     fn: transactionFn,
//     data: transactionResult,
//   } = useFetch(createTransaction);

//   const type = watch("type");
//   const isRecurring = watch("isRecurring");
//   const date = watch("date");

//   return (
//     <form className="space-y-6">
//         {/* AI RECIPT */}
//       <div className="space-y-2">
//         <label className="text-sm font-medium">Type</label>
//         <Select
//           onValueChange={(value) => setValue("type", value)}
//           defaultValue={type}
//         >
//           <SelectTrigger className="w-[180px]">
//             <SelectValue placeholder="Theme" />
//           </SelectTrigger>
//           <SelectContent>
//             <SelectItem value="EXPENSE">Expense</SelectItem>
//             <SelectItem value="INCOME">Income</SelectItem>
//           </SelectContent>
//         </Select>

//         {errors.type && (
//           <p className="text-red-500 text-sm">{errors.type.message}</p>
//         )}
//       </div>

//       <div className="grid gap-6 md:grid-cols-2">
//         <div className="space-y-2">
//           {/* AI RECIPT */}
//           <label className="text-sm font-medium">Amount</label>
//           <Input
//             type="number"
//             step="0.01"
//             placeholder="0.00"
//             {...register("amount")}
//           />

//           {errors.amount && (
//             <p className="text-red-500 text-sm">{errors.type.message}</p>
//           )}
//         </div>

//         <div className="space-y-2">
//           {/* AI RECIPT */}
//           <label className="text-sm font-medium">Account</label>
//           <Select
//             onValueChange={(value) => setValue("accountId", value)}
//             defaultValue={getValues("accountId")}
//           >
//             <SelectTrigger className="w-[180px]">
//               <SelectValue placeholder="Select account" />
//             </SelectTrigger>
//             <SelectContent>
//               {accounts.map((account) => (
//                 <SelectItem key={account.id} value={account.id}>
//                   {account.name} (${parseFloat(account.balance).toFixed(2)})
//                 </SelectItem>
//               ))}
//               <CreateAccountDrawer>
//                 <Button varient="ghost" className="w-full select-none items-center">Create Account</Button>
//               </CreateAccountDrawer>
//               {/* <SelectItem value="EXPENSE">Expense</SelectItem>
//               <SelectItem value="INCOME">Income</SelectItem> */}
//             </SelectContent>
//           </Select>

//           {errors.type && (
//             <p className="text-red-500 text-sm">{errors.type.message}</p>
//           )}
//         </div>
//       </div>
//     </form>
//   );
// };

// export default AddTransactionForm;

"use client";

import { createTransaction, updateTransaction } from "@/actions/transaction";
import { transactionSchema } from "@/app/lib/schema";
import CreateAccountDrawer from "@/components/create-account-drawer";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useFetch from "@/hooks/use-fetch";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { PopoverTrigger } from "@radix-ui/react-popover";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Receipt } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import ReciptScanner from "./receipt-scanner";

const AddTransactionForm = ({
  accounts,
  categories,
  editMode = false,
  initialData = null,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors },
    watch,
    getValues,
    reset,
  } = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues:
      editMode && initialData
        ? {
            type: initialData.type,
            amount: initialData.amount.toString(),
            description: initialData.description,
            accountId: initialData.accountId,
            category: initialData.category,
            date: new Date(initialData.date),
            isRecurring: initialData.isRecurring,
            ...(initialData.recurringInterval && {
              recurringInterval: initialData.recurringInterval,
            }),
          }
        : {
            type: "EXPENSE",
            amount: "",
            description: "",
            date: new Date(),
            accountId: accounts.find((ac) => ac.isDefault)?.id,
            isRecurring: false,
          },
  });

  const {
    loading: transactionLoading,
    fn: transactionFn,
    data: transactionResult,
  } = useFetch(editMode ? updateTransaction : createTransaction);

  const type = watch("type");
  const isRecurring = watch("isRecurring");
  const date = watch("date");

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      amount: parseFloat(data.amount),
    };

    if (editMode) {
      transactionFn(editId, formData);
    } else {
      transactionFn(formData);
    }
  };

  useEffect(() => {
    if (transactionResult?.success && !transactionLoading) {
      toast.success(
        editMode
          ? "Transaction updated successfully!"
          : "Transaction created successfully!"
      );
      reset();
      router.push(`/account/${transactionResult.data.accountId}`);
    }
  }, [transactionResult, transactionLoading, editMode]);

  const filteredCategories = categories.filter(
    (category) =>
      (type === "EXPENSE" && category.type === "EXPENSE") ||
      (type === "INCOME" && category.type === "INCOME")
  );

  const handleScanComplete = (scannedData) => {
    if (scannedData) {
      setValue("amount", scannedData.amount.toString());
      setValue("date", new Date(scannedData.date));
      if (scannedData.description) {
        setValue("description", scannedData.description);
      }
      if (scannedData.category) {
        setValue("category", scannedData.category);
      }
    } else {
      toast.error("Failed to scan receipt. Please try again.");
    }
  };
  return (
    <form
      className="w-full max-w-3xl mx-auto bg-white p-6 rounded-2xl shadow space-y-6"
      onSubmit={handleSubmit(onSubmit)}
    >
      {/* AI Receipt Scanner */}
      {!editMode && <ReciptScanner onScanComplete={handleScanComplete} />}

      {/* Transaction Type */}
      <div className="space-y-2">
        <label className="text-sm font-medium block">Type</label>
        <Select
          onValueChange={(value) => setValue("type", value)}
          defaultValue={type}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EXPENSE">Expense</SelectItem>
            <SelectItem value="INCOME">Income</SelectItem>
          </SelectContent>
        </Select>
        {errors.type && (
          <p className="text-red-500 text-sm">{errors.type.message}</p>
        )}
      </div>

      {/* Amount and Account */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* <div className="grid gap-6 md:grid-cols-2"> */}
        {/* Amount */}
        <div className="space-y-2">
          <label className="text-sm font-medium block">Amount</label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register("amount")}
          />
          {errors.amount && (
            <p className="text-red-500 text-sm">{errors.amount.message}</p>
          )}
        </div>

        {/* Account */}
        <div className="space-y-2">
          <label className="text-sm font-medium block">Account</label>
          <Select
            onValueChange={(value) => setValue("accountId", value)}
            defaultValue={getValues("accountId")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name} (${parseFloat(account.balance).toFixed(2)})
                </SelectItem>
              ))}
              <CreateAccountDrawer>
                <Button variant="ghost" className="w-full justify-start">
                  + Create Account
                </Button>
              </CreateAccountDrawer>
            </SelectContent>
          </Select>
          {errors.accountId && (
            <p className="text-red-500 text-sm">{errors.accountId.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium block">Category</label>
        <Select
          onValueChange={(value) => setValue("category", value)}
          defaultValue={getValues("category")}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {filteredCategories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.category && (
          <p className="text-red-500 text-sm">{errors.category.message}</p>
        )}
      </div>

      <div className="space-y-2 w-full">
        <label className="text-sm font-medium block">Date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal"
            >
              <span>{date ? format(date, "PPP") : "Pick a date"}</span>
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(selectedDate) => setValue("date", selectedDate)}
              disabled={(d) => d > new Date() || d < new Date("1900-01-01")}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {errors.date && (
          <p className="text-red-500 text-sm">{errors.date.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium block">Description</label>
        <Input placeholder="Enter description" {...register("description")} />
        {errors.description && (
          <p className="text-red-500 text-sm">{errors.description.message}</p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3 ">
        <div className="space-y-0.5">
          <label
            htmlFor="isDefault"
            className="text-sm font-medium cursor-pointer"
          >
            Recurring Transaction
          </label>
          <p className="text-sm text-muted-foreground">
            This account will be selected by default for transactions
          </p>
        </div>
        <Switch
          checked={isRecurring}
          onCheckedChange={(checked) => setValue("isRecurring", checked)}
        />
      </div>

      {isRecurring && (
        <div className="space-y-2">
          <label className="text-sm font-medium block">
            Recurring Interval
          </label>
          <Select
            onValueChange={(value) => setValue("recurringInterval", value)}
            defaultValue={getValues("recurringInterval")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Interval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAILY">Daily</SelectItem>
              <SelectItem value="WEEKLY">Weekly</SelectItem>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="YEARLY">Yearly</SelectItem>
            </SelectContent>
          </Select>
          {errors.recurringInterval && (
            <p className="text-red-500 text-sm">
              {errors.recurringInterval.message}
            </p>
          )}
        </div>
      )}

      <div>
        <Button
          type="button"
          variant="outline"
          className="w-full "
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" className="w-full" disabled={transactionLoading}>
          {transactionLoading ? (
            <>
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
              {editMode ? "Updating..." : "Creating..."}
            </>
          ) : editMode ? (
            "Update Transaction"
          ) : (
            "Create Transaction"
          )}
        </Button>
      </div>
    </form>
  );
};

export default AddTransactionForm;
