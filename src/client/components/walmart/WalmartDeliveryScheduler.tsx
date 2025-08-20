/**
 * Walmart Delivery Scheduler Component
 * Advanced delivery scheduling with time slots, recurring orders, and real-time availability
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Truck,
  Home,
  MapPin,
  Repeat,
  Info,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Star,
  Package,
  Sparkles,
  Zap,
  Moon,
  Sun,
  Coffee,
  ShoppingBag,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Label } from '../../../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../../../components/ui/radio-group';
import { Switch } from '../../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip';
import { Calendar } from '../../../components/ui/calendar';
import { cn } from '../../lib/utils';
import { formatPrice } from '../../lib/utils';
import type { DeliverySlot, DeliveryOptions, RecurringSchedule, Address } from '../../../types/walmart-grocery';

interface WalmartDeliverySchedulerProps {
  onScheduleDelivery?: (slot: DeliverySlot, options: DeliveryOptions) => void;
  defaultAddress?: string | Address;
  subtotal?: number;
  showRecurring?: boolean;
  compactMode?: boolean;
  className?: string;
}

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  available: boolean;
  price: number;
  type: 'standard' | 'express' | 'premium';
  capacity: 'low' | 'medium' | 'high';
  icon?: React.ComponentType<{ className?: string }>;
}

// Generate time slots for a given date
const generateTimeSlots = (date: Date): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const isToday = date.toDateString() === new Date().toDateString();
  const currentHour = new Date().getHours();
  
  // Express delivery (within 2 hours)
  if (isToday && currentHour < 20) {
    slots.push({
      id: 'express-1',
      startTime: 'Within 2 hours',
      endTime: '',
      available: true,
      price: 12.95,
      type: 'express',
      capacity: 'medium',
      icon: Zap,
    });
  }
  
  // Standard time slots
  const timeRanges = [
    { start: 7, end: 9, icon: Coffee, label: 'Morning' },
    { start: 9, end: 12, icon: Sun, label: 'Late Morning' },
    { start: 12, end: 16, icon: ShoppingBag, label: 'Afternoon' },
    { start: 16, end: 20, icon: Home, label: 'Evening' },
    { start: 20, end: 22, icon: Moon, label: 'Night' },
  ];
  
  timeRanges.forEach(({ start, end, icon }) => {
    // Skip past time slots for today
    if (isToday && start <= currentHour) return;
    
    const capacity = Math.random() < 0.7 ? 'high' : Math.random() < 0.5 ? 'medium' : 'low';
    const available = capacity !== 'low' || Math.random() < 0.3;
    const isPremium = start >= 20 || start < 9;
    
    slots.push({
      id: `slot-${start}-${end}`,
      startTime: `${start}:00`,
      endTime: `${end}:00`,
      available,
      price: isPremium ? 7.95 : 4.95,
      type: isPremium ? 'premium' : 'standard',
      capacity: capacity as 'low' | 'medium' | 'high',
      icon,
    });
  });
  
  return slots;
};

const DaySchedule: React.FC<{
  date: Date;
  slots: TimeSlot[];
  selectedSlot?: string;
  onSelectSlot: (slotId: string) => void;
  compactMode?: boolean;
}> = ({ date, slots, selectedSlot, onSelectSlot, compactMode = false }) => {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNumber = date.getDate();
  const isToday = date.toDateString() === new Date().toDateString();
  
  if (compactMode) {
    return (
      <div className="space-y-2">
        <div className="font-medium">
          {dayName}, {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {slots?.map(slot => (
            <Button
              key={slot.id}
              variant={selectedSlot === slot.id ? 'default' : 'outline'}
              size="sm"
              className={cn(
                "h-auto py-2 px-3",
                !slot.available && "opacity-50"
              )}
              onClick={() => slot.available && onSelectSlot(slot.id)}
              disabled={!slot.available}
            >
              <div className="text-left">
                <div className="text-xs font-medium">
                  {slot.startTime}{slot.endTime && ` - ${slot.endTime}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatPrice(slot.price)}
                </div>
              </div>
            </Button>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-center">
            <div className="text-xs text-muted-foreground uppercase">{dayName}</div>
            <div className="text-2xl font-bold">{dayNumber}</div>
          </div>
          {isToday && (
            <Badge variant="secondary" className="text-xs">
              Today
            </Badge>
          )}
        </div>
      </div>
      
      <div className="grid gap-2">
        {slots?.map(slot => {
          const Icon = slot?.icon;
          
          return (
            <button
              key={slot.id}
              className={cn(
                "relative flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                selectedSlot === slot.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50",
                !slot.available && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => slot.available && onSelectSlot(slot.id)}
              disabled={!slot.available}
            >
              {Icon && (
                <div className="flex-shrink-0">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {slot.startTime}{slot.endTime && ` - ${slot.endTime}`}
                  </span>
                  {slot.type === 'express' && (
                    <Badge variant="default" className="text-xs">
                      <Zap className="h-3 w-3 mr-1" />
                      Express
                    </Badge>
                  )}
                  {slot.type === 'premium' && (
                    <Badge variant="secondary" className="text-xs">
                      Premium
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-muted-foreground">
                    {formatPrice(slot.price)}
                  </span>
                  
                  {slot.capacity === 'low' && (
                    <span className="text-xs text-orange-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Few slots left
                    </span>
                  )}
                  {slot.capacity === 'medium' && (
                    <span className="text-xs text-blue-600 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Limited availability
                    </span>
                  )}
                </div>
              </div>
              
              {selectedSlot === slot.id && (
                <Check className="h-5 w-5 text-primary" />
              )}
              
              {!slot.available && (
                <div className="absolute inset-0 bg-background/50 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-medium">Unavailable</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const WalmartDeliveryScheduler: React.FC<WalmartDeliverySchedulerProps> = ({
  onScheduleDelivery,
  defaultAddress = '123 Main St, Anytown, USA 12345',
  subtotal = 0,
  showRecurring = true,
  compactMode = false,
  className,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(defaultAddress);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [weekView, setWeekView] = useState(0); // 0 = current week, 1 = next week
  
  // Generate slots for the current week
  const weekSlots = useMemo(() => {
    const slots: { date: Date; slots: TimeSlot[] }[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + (weekView * 7));
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      // Skip past dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) continue;
      
      slots.push({
        date,
        slots: generateTimeSlots(date),
      });
    }
    
    return slots;
  }, [weekView]);
  
  const selectedTimeSlot = useMemo(() => {
    for (const day of weekSlots) {
      const slot = day?.slots?.find(s => s.id === selectedSlot);
      if (slot) return { date: day.date, slot };
    }
    return null;
  }, [selectedSlot, weekSlots]);
  
  const freeDeliveryThreshold = 35;
  const qualifiesForFreeDelivery = subtotal >= freeDeliveryThreshold;
  const deliveryFee = selectedTimeSlot?.slot.price || 4.95;
  const finalDeliveryFee = qualifiesForFreeDelivery && selectedTimeSlot?.slot.type === 'standard' ? 0 : deliveryFee;
  
  const handleSchedule = () => {
    if (selectedTimeSlot && onScheduleDelivery) {
      const deliverySlot: DeliverySlot = {
        id: `slot-${Date.now()}`,
        date: selectedTimeSlot?.date?.toISOString().split('T')[0] || '', // Convert Date to string
        start_time: selectedTimeSlot?.slot?.startTime,
        end_time: selectedTimeSlot?.slot?.endTime,
        available: true,
        price: finalDeliveryFee,
        capacity: 100,
        reserved: false,
      };
      
      // Use the actual DeliveryOptions interface structure
      const options: DeliveryOptions = {
        available: true,
        windows: [deliverySlot],
        fees: {
          delivery: finalDeliveryFee,
          service: 0,
          tip: 0,
        },
      };
      
      onScheduleDelivery(deliverySlot, options);
    }
  };
  
  if (compactMode) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Delivery Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={deliveryType} onValueChange={(value: any) => setDeliveryType(value)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="delivery" id="delivery" />
              <Label htmlFor="delivery" className="flex items-center gap-2 cursor-pointer">
                <Truck className="h-4 w-4" />
                Delivery
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="pickup" id="pickup" />
              <Label htmlFor="pickup" className="flex items-center gap-2 cursor-pointer">
                <Package className="h-4 w-4" />
                Pickup
              </Label>
            </div>
          </RadioGroup>
          
          <div className="space-y-2">
            {weekSlots.slice(0, 3).map(({ date, slots }) => (
              <DaySchedule
                key={date.toISOString()}
                date={date}
                slots={slots}
                selectedSlot={selectedSlot}
                onSelectSlot={setSelectedSlot}
                compactMode
              />
            ))}
          </div>
          
          {selectedTimeSlot && (
            <div className="p-3 bg-primary/5 rounded-lg">
              <p className="text-sm font-medium">
                {selectedTimeSlot?.date?.toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedTimeSlot?.slot?.startTime}
                {selectedTimeSlot?.slot?.endTime && ` - ${selectedTimeSlot?.slot?.endTime}`}
              </p>
              <p className="text-sm font-medium mt-1">
                {finalDeliveryFee === 0 ? 'FREE' : formatPrice(finalDeliveryFee)}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="pt-3">
          <Button 
            className="w-full" 
            onClick={handleSchedule}
            disabled={!selectedSlot}
          >
            Schedule {deliveryType === 'delivery' ? 'Delivery' : 'Pickup'}
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
  return (
    <>
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Schedule Delivery
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Delivery Type Selection */}
          <Tabs value={deliveryType} onValueChange={(value: any) => setDeliveryType(value)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="delivery" className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Delivery
              </TabsTrigger>
              <TabsTrigger value="pickup" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Store Pickup
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="delivery" className="space-y-4 mt-4">
              {/* Delivery Address */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Delivery Address</p>
                    <p className="text-sm text-muted-foreground">
                      {typeof selectedAddress === 'string' 
                        ? selectedAddress 
                        : `${selectedAddress.street1}, ${selectedAddress.city}, ${selectedAddress.state} ${selectedAddress.zipCode}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddressDialog(true)}
                >
                  Change
                </Button>
              </div>
              
              {/* Free Delivery Progress */}
              {!qualifiesForFreeDelivery && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-medium">
                      Add {formatPrice(freeDeliveryThreshold - subtotal)} more for free standard delivery
                    </p>
                  </div>
                  <div className="h-2 bg-amber-200 dark:bg-amber-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-600 transition-all"
                      style={{ width: `${(subtotal / freeDeliveryThreshold) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="pickup" className="space-y-4 mt-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-start gap-3">
                  <Home className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Walmart Supercenter</p>
                    <p className="text-sm text-muted-foreground">1234 Retail Blvd, Shopping City, SC 54321</p>
                    <p className="text-sm text-muted-foreground mt-1">Open until 11:00 PM</p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          {/* Week Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekView(Math.max(0, weekView - 1))}
              disabled={weekView === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium">
              {weekView === 0 ? 'This Week' : `Week of ${
                new Date(new Date().setDate(new Date().getDate() + (weekView * 7))).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })
              }`}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekView(weekView + 1)}
              disabled={weekView >= 3}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Time Slots Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {weekSlots?.map(({ date, slots }) => (
              <DaySchedule
                key={date.toISOString()}
                date={date}
                slots={slots}
                selectedSlot={selectedSlot}
                onSelectSlot={setSelectedSlot}
              />
            ))}
          </div>
          
          {/* Recurring Delivery Option */}
          {showRecurring && (
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label htmlFor="recurring" className="flex items-center gap-2 cursor-pointer">
                  <Repeat className="h-4 w-4" />
                  Make this a recurring {deliveryType}
                </Label>
                <Switch
                  id="recurring"
                  checked={recurringEnabled}
                  onCheckedChange={setRecurringEnabled}
                />
              </div>
              
              {recurringEnabled && (
                <Select value={recurringFrequency} onValueChange={(value: any) => setRecurringFrequency(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Every week</SelectItem>
                    <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                    <SelectItem value="monthly">Every month</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          
          {/* Selected Slot Summary */}
          {selectedTimeSlot && (
            <div className="p-4 bg-primary/5 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {selectedTimeSlot?.date?.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedTimeSlot?.slot?.startTime}
                    {selectedTimeSlot?.slot?.endTime && ` - ${selectedTimeSlot?.slot?.endTime}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Delivery fee</p>
                  <p className="font-medium">
                    {finalDeliveryFee === 0 ? (
                      <span className="text-green-600">FREE</span>
                    ) : (
                      formatPrice(finalDeliveryFee)
                    )}
                  </p>
                </div>
              </div>
              
              {recurringEnabled && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Repeat className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm">
                    Repeats {recurringFrequency === 'weekly' ? 'every week' : 
                             recurringFrequency === 'biweekly' ? 'every 2 weeks' : 
                             'every month'}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
        
        <CardFooter>
          <Button 
            className="w-full" 
            size="lg"
            onClick={handleSchedule}
            disabled={!selectedSlot}
          >
            Confirm {deliveryType === 'delivery' ? 'Delivery' : 'Pickup'} Schedule
          </Button>
        </CardFooter>
      </Card>
      
      {/* Address Change Dialog */}
      <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Delivery Address</DialogTitle>
            <DialogDescription>
              Select a saved address or add a new one
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3">
            <RadioGroup 
              value={typeof selectedAddress === 'string' ? selectedAddress : JSON.stringify(selectedAddress)} 
              onValueChange={(value: any) => {
                try {
                  const parsed = JSON.parse(value);
                  setSelectedAddress(parsed);
                } catch {
                  setSelectedAddress(value);
                }
              }}
            >
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value={typeof defaultAddress === 'string' ? defaultAddress : JSON.stringify(defaultAddress)} id="default" />
                <Label htmlFor="default" className="flex-1 cursor-pointer">
                  <p className="font-medium">Home</p>
                  <p className="text-sm text-muted-foreground">
                    {typeof defaultAddress === 'string' 
                      ? defaultAddress 
                      : `${defaultAddress.street1}, ${defaultAddress.city}, ${defaultAddress.state} ${defaultAddress.zipCode}`}
                  </p>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="456 Oak St, Anytown, USA 12345" id="work" />
                <Label htmlFor="work" className="flex-1 cursor-pointer">
                  <p className="font-medium">Work</p>
                  <p className="text-sm text-muted-foreground">456 Oak St, Anytown, USA 12345</p>
                </Label>
              </div>
            </RadioGroup>
            
            <Button variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add New Address
            </Button>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddressDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddressDialog(false)}>
              Save Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};