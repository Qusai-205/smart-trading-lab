// Equiti MT5 Demo → Smart Trading Lab
// READ-ONLY bridge: it never opens, closes, modifies, or sends trade orders.
#property strict
#property version   "1.0"
#property description "Sends Equiti Demo account summary and OHLC bars to Smart Trading Lab."

input string DashboardUrl = "https://YOUR-PUBLISHED-DOMAIN/api/mt5/demo/ingest";
input string BridgeToken = "";
input string SymbolToExport = "XAUUSD";
input ENUM_TIMEFRAMES Timeframe = PERIOD_D1;
input int BarsToExport = 120;
input int SyncEverySeconds = 300;

const string REQUIRED_SERVER_PREFIX = "EquitiGroupLtd-Demo";

int OnInit()
{
   if(AccountInfoInteger(ACCOUNT_TRADE_MODE) != ACCOUNT_TRADE_MODE_DEMO)
   {
      Print("This bridge only accepts a MetaTrader demo account.");
      return(INIT_FAILED);
   }
   if(StringFind(AccountInfoString(ACCOUNT_SERVER), REQUIRED_SERVER_PREFIX) != 0)
   {
      Print("Unexpected server. This bridge only accepts an Equiti demo server starting with: ", REQUIRED_SERVER_PREFIX);
      return(INIT_FAILED);
   }
   if(StringLen(BridgeToken) < 32 || StringFind(DashboardUrl, "YOUR-PUBLISHED-DOMAIN") >= 0)
   {
      Print("Set a published dashboard URL and a private BridgeToken (32+ characters) before starting.");
      return(INIT_PARAMETERS_INCORRECT);
   }
   EventSetTimer((int)MathMax(60, SyncEverySeconds));
   SendSnapshot();
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   SendSnapshot();
}

void SendSnapshot()
{
   MqlRates rates[];
   ArraySetAsSeries(rates, false);
   int copied = CopyRates(SymbolToExport, Timeframe, 0, BarsToExport, rates);
   if(copied < 60)
   {
      Print("Not enough bars to sync. Required: 60, received: ", copied);
      return;
   }

   string payload = "{";
   payload += "\"broker\":\"Equiti Jordan\",";
   payload += "\"environment\":\"demo\",";
   payload += "\"server\":\"" + EscapeJson(AccountInfoString(ACCOUNT_SERVER)) + "\",";
   payload += "\"accountLogin\":\"" + IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN)) + "\",";
   payload += "\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
   payload += "\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
   payload += "\"leverage\":" + IntegerToString((long)AccountInfoInteger(ACCOUNT_LEVERAGE)) + ",";
   payload += "\"syncedAtMs\":" + IntegerToString((long)TimeCurrent() * 1000) + ",";
   payload += "\"positions\":" + BuildPositionsJson() + ",";
   payload += "\"bars\":" + BuildBarsJson(rates, copied) + "}";

   char body[];
   int length = StringToCharArray(payload, body, 0, WHOLE_ARRAY, CP_UTF8);
   if(length > 0) ArrayResize(body, length - 1);
   char response[];
   string responseHeaders;
   string headers = "Content-Type: application/json\r\nx-mt5-demo-token: " + BridgeToken + "\r\n";
   ResetLastError();
   int status = WebRequest("POST", DashboardUrl, headers, 15000, body, response, responseHeaders);
   if(status < 200 || status >= 300)
   {
      Print("Dashboard sync failed. HTTP=", status, " error=", GetLastError());
      Print("Add the dashboard domain under Tools > Options > Expert Advisors > Allow WebRequest.");
      return;
   }
   Print("Demo snapshot synced successfully. HTTP=", status);
}

string BuildPositionsJson()
{
   string json = "[";
   bool first = true;
   for(int index = 0; index < PositionsTotal(); index++)
   {
      ulong ticket = PositionGetTicket(index);
      if(ticket == 0) continue;
      if(!first) json += ",";
      string side = PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "buy" : "sell";
      json += "{\"symbol\":\"" + EscapeJson(PositionGetString(POSITION_SYMBOL)) + "\",";
      json += "\"volume\":" + DoubleToString(PositionGetDouble(POSITION_VOLUME), 2) + ",";
      json += "\"side\":\"" + side + "\",";
      json += "\"profit\":" + DoubleToString(PositionGetDouble(POSITION_PROFIT), 2) + "}";
      first = false;
   }
   return(json + "]");
}

string BuildBarsJson(const MqlRates &rates[], const int count)
{
   string label = TimeframeLabel(Timeframe);
   string json = "[";
   for(int index = 0; index < count; index++)
   {
      if(index > 0) json += ",";
      json += "{\"symbol\":\"" + EscapeJson(SymbolToExport) + "\",";
      json += "\"timeframe\":\"" + label + "\",";
      json += "\"timestamp\":" + IntegerToString((long)rates[index].time * 1000) + ",";
      json += "\"open\":" + DoubleToString(rates[index].open, _Digits) + ",";
      json += "\"high\":" + DoubleToString(rates[index].high, _Digits) + ",";
      json += "\"low\":" + DoubleToString(rates[index].low, _Digits) + ",";
      json += "\"close\":" + DoubleToString(rates[index].close, _Digits) + ",";
      json += "\"volume\":" + IntegerToString((long)rates[index].tick_volume) + "}";
   }
   return(json + "]");
}

string TimeframeLabel(ENUM_TIMEFRAMES timeframe)
{
   if(timeframe == PERIOD_M15) return("M15");
   if(timeframe == PERIOD_H1) return("H1");
   if(timeframe == PERIOD_H4) return("H4");
   return("D1");
}

string EscapeJson(string value)
{
   StringReplace(value, "\\", "\\\\");
   StringReplace(value, "\"", "\\\"");
   StringReplace(value, "\n", "\\n");
   StringReplace(value, "\r", "\\r");
   return(value);
}
