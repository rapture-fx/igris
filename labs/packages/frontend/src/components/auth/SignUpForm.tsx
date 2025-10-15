/**
 * Enhanced Sign Up Form Component with Elegant UX
 */
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Building,
  Loader2,
  Check,
  X,
  ArrowRight,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// Password strength validation
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/\d/, "Password must contain at least one number")
  .regex(
    /[!@#$%^&*(),.?":{}|<>]/,
    "Password must contain at least one special character",
  );

// Validation schema
const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: passwordSchema,
  first_name: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name is too long"),
  last_name: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name is too long"),
  tenant_name: z.string().max(100, "Organization name is too long").optional(),
});

type SignUpFormData = z.infer<typeof signUpSchema>;

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "One number", test: (p) => /\d/.test(p) },
  {
    label: "One special character",
    test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p),
  },
];

export function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { signUp, isLoading } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  const watchedPassword = watch("password", "");
  const watchedEmail = watch("email", "");
  const watchedFirstName = watch("first_name", "");
  const watchedLastName = watch("last_name", "");

  const onSubmit = async (data: SignUpFormData) => {
    try {
      await signUp({
        email: data.email,
        password: data.password,
        first_name: data.first_name,
        last_name: data.last_name,
        tenant_name: data.tenant_name,
      });
    } catch (error) {
      // Error is handled in the useAuth hook
    }
  };

  const isFormLoading = isLoading || isSubmitting;

  const getPasswordStrength = () => {
    const validRequirements = passwordRequirements.filter((req) =>
      req.test(watchedPassword),
    );
    return (validRequirements.length / passwordRequirements.length) * 100;
  };

  const getStrengthColor = () => {
    const strength = getPasswordStrength();
    if (strength < 40) return "bg-red-500";
    if (strength < 80) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStrengthLabel = () => {
    const strength = getPasswordStrength();
    if (strength < 40) return "Weak";
    if (strength < 80) return "Good";
    return "Strong";
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Name Fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label
            htmlFor="first_name"
            className="block text-sm font-semibold text-gray-700"
          >
            First Name
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
              <User
                className={`h-5 w-5 transition-colors duration-200 ${
                  watchedFirstName ? "text-blue-500" : "text-gray-400"
                }`}
              />
            </div>
            <input
              {...register("first_name")}
              type="text"
              id="first_name"
              className={`block w-full pl-12 pr-4 py-3 border-2 rounded-xl shadow-sm placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-0 bg-gray-50/50 backdrop-blur-sm ${
                errors.first_name
                  ? "border-red-300 focus:border-red-500"
                  : watchedFirstName
                    ? "border-blue-300 focus:border-blue-500 bg-blue-50/30"
                    : "border-gray-200 focus:border-blue-400 hover:border-gray-300"
              }`}
              placeholder="John"
              disabled={isFormLoading}
              onFocus={() => setFocusedField("first_name")}
              onBlur={() => setFocusedField(null)}
            />
            {watchedFirstName && !errors.first_name && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            )}
          </div>
          {errors.first_name && (
            <p className="text-xs text-red-600 flex items-center mt-1 animate-in slide-in-from-left-1 duration-200">
              <AlertCircle className="w-3 h-3 mr-1" />
              {errors.first_name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="last_name"
            className="block text-sm font-semibold text-gray-700"
          >
            Last Name
          </label>
          <div className="relative group">
            <input
              {...register("last_name")}
              type="text"
              id="last_name"
              className={`block w-full px-4 py-3 border-2 rounded-xl shadow-sm placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-0 bg-gray-50/50 backdrop-blur-sm ${
                errors.last_name
                  ? "border-red-300 focus:border-red-500"
                  : watchedLastName
                    ? "border-blue-300 focus:border-blue-500 bg-blue-50/30"
                    : "border-gray-200 focus:border-blue-400 hover:border-gray-300"
              }`}
              placeholder="Doe"
              disabled={isFormLoading}
              onFocus={() => setFocusedField("last_name")}
              onBlur={() => setFocusedField(null)}
            />
            {watchedLastName && !errors.last_name && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            )}
          </div>
          {errors.last_name && (
            <p className="text-xs text-red-600 flex items-center mt-1 animate-in slide-in-from-left-1 duration-200">
              <AlertCircle className="w-3 h-3 mr-1" />
              {errors.last_name.message}
            </p>
          )}
        </div>
      </div>

      {/* Email Field */}
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="block text-sm font-semibold text-gray-700"
        >
          Email Address
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
            <Mail
              className={`h-5 w-5 transition-colors duration-200 ${
                watchedEmail ? "text-blue-500" : "text-gray-400"
              }`}
            />
          </div>
          <input
            {...register("email")}
            type="email"
            id="email"
            className={`block w-full pl-12 pr-4 py-4 border-2 rounded-xl shadow-sm placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-0 bg-gray-50/50 backdrop-blur-sm ${
              errors.email
                ? "border-red-300 focus:border-red-500"
                : watchedEmail
                  ? "border-blue-300 focus:border-blue-500 bg-blue-50/30"
                  : "border-gray-200 focus:border-blue-400 hover:border-gray-300"
            }`}
            placeholder="john@example.com"
            disabled={isFormLoading}
            onFocus={() => setFocusedField("email")}
            onBlur={() => setFocusedField(null)}
          />
          {watchedEmail && !errors.email && (
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
          )}
        </div>
        {errors.email && (
          <p className="text-sm text-red-600 flex items-center mt-1 animate-in slide-in-from-left-1 duration-200">
            <AlertCircle className="w-4 h-4 mr-2" />
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Organization Field */}
      <div className="space-y-2">
        <label
          htmlFor="tenant_name"
          className="block text-sm font-semibold text-gray-700"
        >
          Organization Name{" "}
          <span className="text-gray-400 font-normal">(Optional)</span>
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
            <Building className="h-5 w-5 text-gray-400" />
          </div>
          <input
            {...register("tenant_name")}
            type="text"
            id="tenant_name"
            className="block w-full pl-12 pr-4 py-4 border-2 rounded-xl shadow-sm placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-0 bg-gray-50/50 backdrop-blur-sm border-gray-200 focus:border-blue-400 hover:border-gray-300"
            placeholder="Acme Corp"
            disabled={isFormLoading}
          />
        </div>
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <label
          htmlFor="password"
          className="block text-sm font-semibold text-gray-700"
        >
          Password
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
            <Lock
              className={`h-5 w-5 transition-colors duration-200 ${
                watchedPassword ? "text-blue-500" : "text-gray-400"
              }`}
            />
          </div>
          <input
            {...register("password")}
            type={showPassword ? "text" : "password"}
            id="password"
            className={`block w-full pl-12 pr-12 py-4 border-2 rounded-xl shadow-sm placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-0 bg-gray-50/50 backdrop-blur-sm ${
              errors.password
                ? "border-red-300 focus:border-red-500"
                : watchedPassword
                  ? "border-blue-300 focus:border-blue-500 bg-blue-50/30"
                  : "border-gray-200 focus:border-blue-400 hover:border-gray-300"
            }`}
            placeholder="Create a strong password"
            disabled={isFormLoading}
            onFocus={() => setFocusedField("password")}
            onBlur={() => setFocusedField(null)}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-4 flex items-center z-10 hover:scale-110 transition-transform"
            onClick={() => setShowPassword(!showPassword)}
            disabled={isFormLoading}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            ) : (
              <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            )}
          </button>
        </div>

        {/* Password Strength Indicator */}
        {watchedPassword && (
          <div className="space-y-3 animate-in slide-in-from-top-1 duration-300">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">
                Password Strength
              </span>
              <span
                className={`text-xs font-semibold ${
                  getPasswordStrength() < 40
                    ? "text-red-600"
                    : getPasswordStrength() < 80
                      ? "text-yellow-600"
                      : "text-green-600"
                }`}
              >
                {getStrengthLabel()}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor()}`}
                style={{ width: `${getPasswordStrength()}%` }}
              ></div>
            </div>

            {/* Password Requirements */}
            <div className="grid grid-cols-1 gap-1">
              {passwordRequirements.map((req, index) => {
                const isValid = req.test(watchedPassword);
                return (
                  <div key={index} className="flex items-center text-xs">
                    {isValid ? (
                      <Check className="h-3 w-3 text-green-500 mr-2" />
                    ) : (
                      <X className="h-3 w-3 text-red-500 mr-2" />
                    )}
                    <span
                      className={isValid ? "text-green-600" : "text-red-600"}
                    >
                      {req.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {errors.password && (
          <p className="text-sm text-red-600 flex items-center mt-1 animate-in slide-in-from-left-1 duration-200">
            <AlertCircle className="w-4 h-4 mr-2" />
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isFormLoading}
        className="group relative w-full flex justify-center items-center py-4 px-6 border border-transparent rounded-xl text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] transform"
      >
        {isFormLoading ? (
          <>
            <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
            <span>Creating account...</span>
          </>
        ) : (
          <>
            <span>Create Account</span>
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </>
        )}

        {/* Button Glow Effect */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 opacity-0 group-hover:opacity-20 transition-opacity blur-xl"></div>
      </button>

      {/* Divider */}
      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-gray-500">
            Already have an account?
          </span>
        </div>
      </div>

      {/* Sign In Link */}
      <div className="text-center">
        <Link
          href="/auth/signin"
          className="inline-flex items-center px-6 py-3 border-2 border-gray-200 rounded-xl text-base font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 hover:scale-[1.02] transform"
        >
          Sign in instead
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>
    </form>
  );
}
