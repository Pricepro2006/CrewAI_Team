/**
 * Walmart Chat Interface Component
 * AI-powered shopping assistant with natural language understanding
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  MessageCircle,
  Send,
  Bot,
  User,
  ShoppingCart,
  Search,
  Package,
  Calendar,
  DollarSign,
  Sparkles,
  Loader2,
  Paperclip,
  Mic,
  MicOff,
  Image,
  MoreVertical,
  ThumbsUp,
  ThumbsDown,
  Copy,
  RefreshCw,
  X,
  ChevronDown,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../../components/ui/card.js';
import { Button } from '../../../components/ui/button.js';
import { Badge } from '../../../components/ui/badge.js';
import { Input } from '../../../components/ui/input.js';
import { ScrollArea } from '../../../components/ui/scroll-area.js';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu.js';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip.js';
import { Separator } from '../../../components/ui/separator.js';
import { cn } from '../../lib/utils.js';
import { formatPrice } from '../../lib/utils.js';
import { useCart } from '../../hooks/useCart.js';
import { useGroceryStore } from '../../store/groceryStore.js';
import type { WalmartProduct } from '../../../types/walmart-grocery.js';

interface WalmartChatInterfaceProps {
  onProductSelect?: (product: WalmartProduct) => void;
  initialMessage?: string;
  compactMode?: boolean;
  className?: string;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: ChatAttachment[];
  suggestions?: string[];
  products?: WalmartProduct[];
  actions?: ChatAction[];
  feedback?: 'positive' | 'negative';
  isLoading?: boolean;
}

interface ChatAttachment {
  type: 'image' | 'list' | 'product';
  data: any;
}

interface ChatAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

interface QuickAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  prompt: string;
}

const quickActions: QuickAction[] = [
  { label: 'Find deals', icon: DollarSign, prompt: 'Show me today\'s best deals' },
  { label: 'Quick reorder', icon: RefreshCw, prompt: 'Reorder my usual items' },
  { label: 'Meal planning', icon: Calendar, prompt: 'Help me plan meals for the week' },
  { label: 'Budget check', icon: DollarSign, prompt: 'How much have I spent this month?' },
];

const suggestionPrompts = [
  'Add milk to my cart',
  'What\'s on sale today?',
  'Find gluten-free bread',
  'Schedule delivery for tomorrow',
  'Show my grocery lists',
  'Track my recent order',
];

// Simulated AI responses
const generateAssistantResponse = (userMessage: string): Partial<ChatMessage> => {
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes('deal') || lowerMessage.includes('sale')) {
    return {
      content: 'I found some great deals for you today! Here are the top products on sale:',
      products: [
        {
          id: 'deal-1',
          name: 'Organic Bananas',
          price: 0.49,
          originalPrice: 0.69,
          category: 'Produce',
          unit: 'lb',
          inStock: true,
          thumbnailUrl: '',
        },
        {
          id: 'deal-2',
          name: 'Whole Milk Gallon',
          price: 2.99,
          originalPrice: 3.99,
          category: 'Dairy',
          unit: 'gallon',
          inStock: true,
          thumbnailUrl: '',
        },
      ],
      suggestions: ['Show me more deals', 'Add all to cart', 'Filter by category'],
    };
  }
  
  if (lowerMessage.includes('reorder')) {
    return {
      content: 'Based on your purchase history, here are items you might want to reorder:',
      products: [
        {
          id: 'reorder-1',
          name: 'Eggs - Large, Dozen',
          price: 3.49,
          category: 'Dairy',
          unit: 'dozen',
          inStock: true,
        },
        {
          id: 'reorder-2',
          name: 'Bread - Whole Wheat',
          price: 2.99,
          category: 'Bakery',
          unit: 'loaf',
          inStock: true,
        },
      ],
      actions: [
        {
          label: 'Add all to cart',
          icon: ShoppingCart,
          action: () => console.log('Adding all to cart'),
        },
        {
          label: 'Create grocery list',
          icon: Package,
          action: () => console.log('Creating list'),
        },
      ],
    };
  }
  
  if (lowerMessage.includes('meal') || lowerMessage.includes('plan')) {
    return {
      content: 'I can help you plan your meals! Here are some suggestions for this week:\n\n**Monday**: Spaghetti Bolognese\n**Tuesday**: Grilled Chicken Salad\n**Wednesday**: Vegetable Stir Fry\n**Thursday**: Tacos\n**Friday**: Homemade Pizza\n\nWould you like me to create a shopping list for these meals?',
      suggestions: ['Create shopping list', 'Show me recipes', 'Change meal plan'],
    };
  }
  
  if (lowerMessage.includes('budget') || lowerMessage.includes('spent')) {
    return {
      content: 'Here\'s your spending summary for this month:\n\n💰 **Total Spent**: $342.56\n📊 **Budget Used**: 57% ($342.56 / $600)\n📈 **Compared to last month**: -12%\n\nYou\'re doing great staying within budget! You have $257.44 remaining for this month.',
      actions: [
        {
          label: 'View details',
          icon: Info,
          action: () => console.log('Viewing budget details'),
        },
      ],
      suggestions: ['Show spending by category', 'Set budget alert', 'View savings tips'],
    };
  }
  
  // Default response
  return {
    content: 'I\'m here to help with your grocery shopping! I can help you find products, check prices, track orders, plan meals, and manage your budget. What would you like to do?',
    suggestions: suggestionPrompts,
  };
};

const MessageContent: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const { addItem } = useCart();
  
  if (message.isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Thinking...</span>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      
      {/* Product cards */}
      {message.products && message.products.length > 0 && (
        <div className="grid gap-2">
          {message.products.map(product => (
            <div
              key={product.id}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="h-12 w-12 rounded bg-gray-100 flex items-center justify-center">
                <Package className="h-6 w-6 text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{product.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{formatPrice(product.price)}</span>
                  {product.originalPrice && product.originalPrice > product.price && (
                    <>
                      <span className="text-xs text-muted-foreground line-through">
                        {formatPrice(product.originalPrice)}
                      </span>
                      <Badge variant="destructive" className="text-xs">
                        Save {formatPrice(product.originalPrice - product.price)}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => addItem(product)}
              >
                <ShoppingCart className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      
      {/* Action buttons */}
      {message.actions && message.actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {message.actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Button
                key={index}
                size="sm"
                variant="outline"
                onClick={action.action}
              >
                <Icon className="h-4 w-4 mr-2" />
                {action.label}
              </Button>
            );
          })}
        </div>
      )}
      
      {/* Suggestions */}
      {message.suggestions && message.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {message.suggestions.map((suggestion, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              {suggestion}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export const WalmartChatInterface: React.FC<WalmartChatInterfaceProps> = ({
  onProductSelect,
  initialMessage,
  compactMode = false,
  className,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hello! I\'m your Walmart shopping assistant. I can help you find products, check prices, track orders, and much more. What can I help you with today?',
      timestamp: new Date(),
      suggestions: suggestionPrompts,
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (initialMessage) {
      handleSendMessage(initialMessage);
    }
  }, [initialMessage]);
  
  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);
  
  const handleSendMessage = async (message?: string) => {
    const content = message || inputValue.trim();
    if (!content) return;
    
    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);
    
    // Add loading message
    const loadingMessage: ChatMessage = {
      id: `loading-${Date.now()}`,
      type: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };
    
    setMessages(prev => [...prev, loadingMessage]);
    
    // Simulate API call
    setTimeout(() => {
      const response = generateAssistantResponse(content);
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        type: 'assistant',
        content: response.content || '',
        timestamp: new Date(),
        products: response.products,
        suggestions: response.suggestions,
        actions: response.actions,
      };
      
      setMessages(prev => prev.filter(m => !m.isLoading).concat(assistantMessage));
      setIsTyping(false);
    }, 1000 + Math.random() * 1000);
  };
  
  const handleFeedback = (messageId: string, feedback: 'positive' | 'negative') => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId ? { ...msg, feedback } : msg
      )
    );
  };
  
  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };
  
  const handleVoiceInput = () => {
    setIsListening(!isListening);
    // In a real app, implement speech recognition here
  };
  
  if (compactMode) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Shopping Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Bot className="h-6 w-6 text-primary mt-0.5" />
              <div className="flex-1 text-sm">
                <p>How can I help you shop today?</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {quickActions.slice(0, 2).map((action, index) => {
                    const Icon = action.icon;
                    return (
                      <Button
                        key={index}
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleSendMessage(action.prompt)}
                      >
                        <Icon className="h-3 w-3 mr-1" />
                        {action.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="pt-3">
          <div className="flex gap-2 w-full">
            <Input
              placeholder="Ask me anything..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1"
            />
            <Button size="icon" onClick={() => handleSendMessage()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    );
  }
  
  return (
    <Card className={cn("w-full h-[600px] flex flex-col", className)}>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback className="bg-primary text-primary-foreground">
                <Bot className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>Walmart Assistant</CardTitle>
              <p className="text-sm text-muted-foreground">
                {isTyping ? 'Typing...' : 'Online'}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Clear Chat</DropdownMenuItem>
              <DropdownMenuItem>Export History</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Settings</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full px-4" ref={scrollAreaRef}>
          <div className="py-4 space-y-4">
            {messages.map((message, index) => {
              const isUser = message.type === 'user';
              
              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    isUser && "flex-row-reverse"
                  )}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className={cn(
                    "flex-1 space-y-2",
                    isUser && "flex flex-col items-end"
                  )}>
                    <div className={cn(
                      "rounded-lg p-3 max-w-[80%]",
                      isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}>
                      <MessageContent message={message} />
                    </div>
                    
                    {!isUser && !message.isLoading && (
                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => handleFeedback(message.id, 'positive')}
                              >
                                <ThumbsUp className={cn(
                                  "h-3 w-3",
                                  message.feedback === 'positive' && "fill-current"
                                )} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Helpful</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => handleFeedback(message.id, 'negative')}
                              >
                                <ThumbsDown className={cn(
                                  "h-3 w-3",
                                  message.feedback === 'negative' && "fill-current"
                                )} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Not helpful</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => handleCopyMessage(message.content)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
      
      <CardFooter className="border-t p-4">
        <div className="w-full space-y-3">
          {/* Quick actions */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <Sparkles className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0"
                  onClick={() => handleSendMessage(action.prompt)}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {action.label}
                </Button>
              );
            })}
          </div>
          
          {/* Input area */}
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                placeholder="Type your message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="pr-20"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={handleVoiceInput}
                      >
                        {isListening ? (
                          <MicOff className="h-4 w-4 text-destructive" />
                        ) : (
                          <Mic className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isListening ? 'Stop recording' : 'Voice input'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Attach image</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            
            <Button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isTyping}
            >
              {isTyping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
};